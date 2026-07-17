import type { Page } from "playwright-core";
import type {
  ActionRequest,
  ActionResult,
  ConditionRequest,
  LeadContext,
  LinkedInProvider,
  ReplyCheck,
} from "./provider";
import { humanDelay, isConfigured, withPage } from "./browser";

/**
 * Real LinkedIn provider via Playwright browser automation.
 *
 * ⚠️ Automating LinkedIn violates its User Agreement and risks account
 * restriction/ban. This runs against the operator's OWN account (li_at cookie)
 * and relies on the app's daily limits + working hours for safe pacing.
 *
 * LinkedIn's DOM changes often — the selectors below are best-effort and must
 * be verified against the current site. Every action is wrapped so a failure
 * degrades gracefully (logged by the engine) rather than crashing the run.
 * Set LINKEDIN_DRY_RUN=true to navigate/read but skip mutating clicks.
 */
export class PlaywrightLinkedInProvider implements LinkedInProvider {
  readonly name = "playwright";

  private dryRun(): boolean {
    return process.env.LINKEDIN_DRY_RUN === "true";
  }

  private ensureConfigured(): ActionResult | null {
    if (!isConfigured()) {
      return {
        ok: false,
        detail: "LINKEDIN_LI_AT が未設定のため実行できません（プロバイダ設定を確認）",
      };
    }
    return null;
  }

  private profileUrl(lead: LeadContext): string | null {
    return lead.profileUrl && /linkedin\.com\/in\//.test(lead.profileUrl) ? lead.profileUrl : null;
  }

  async execute(req: ActionRequest): Promise<ActionResult> {
    const notConfigured = this.ensureConfigured();
    if (notConfigured) return notConfigured;

    try {
      switch (req.actionType) {
        case "VIEW_PROFILE":
          return await this.viewProfile(req);
        case "CONNECT_REQUEST":
          return await this.connect(req);
        case "MESSAGE":
          return await this.message(req);
        case "FOLLOW":
          return await this.follow(req);
        case "LIKE_POST":
          return await this.likePost(req);
        case "WITHDRAW_REQUEST":
          return await this.withdraw(req);
        // Not implemented for the LinkedIn browser provider — skip so the
        // sequence keeps moving rather than marking the lead failed.
        case "INMAIL":
        case "ENDORSE_SKILL":
        case "FIND_EMAIL":
        case "SEND_EMAIL":
          return {
            ok: true,
            detail: `${req.actionType} はこのプロバイダで未対応のためスキップしました`,
          };
        default:
          return { ok: false, detail: "未対応のアクション" };
      }
    } catch (err) {
      return {
        ok: false,
        detail: `実行エラー: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async gotoProfile(page: Page, lead: LeadContext): Promise<boolean> {
    const url = this.profileUrl(lead);
    if (!url) return false;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay();
    return true;
  }

  private async viewProfile(req: ActionRequest): Promise<ActionResult> {
    return withPage(async (page) => {
      const ok = await this.gotoProfile(page, req.lead);
      if (!ok) return { ok: false, detail: "プロフィールURLが不正です" };
      await humanDelay(1200, 3000);
      return { ok: true, detail: "プロフィールを閲覧しました" };
    });
  }

  private async connect(req: ActionRequest): Promise<ActionResult> {
    return withPage(async (page) => {
      if (!(await this.gotoProfile(page, req.lead)))
        return { ok: false, detail: "プロフィールURLが不正です" };

      // Primary "Connect" button, or via the "More" menu as a fallback.
      let connect = page
        .locator('button:has-text("つながりを申請"), button[aria-label*="つながりを申請"], button:has-text("Connect")')
        .first();
      if ((await connect.count()) === 0) {
        const more = page.locator('button:has-text("その他"), button[aria-label="More actions"]').first();
        if (await more.count()) {
          await more.click();
          await humanDelay(500, 1200);
          connect = page
            .locator('div[role="button"]:has-text("つながりを申請"), div[role="button"]:has-text("Connect")')
            .first();
        }
      }
      if ((await connect.count()) === 0) {
        return { ok: false, detail: "接続ボタンが見つかりませんでした（既に接続済み/申請済みの可能性）" };
      }
      if (this.dryRun()) return { ok: true, detail: "[dry-run] 接続リクエスト（送信せず）" };

      await connect.click();
      await humanDelay(600, 1400);

      // Optional note dialog: send without a note.
      const sendWithout = page
        .locator('button[aria-label="メモを追加せずに送信"], button:has-text("送信"), button[aria-label="Send without a note"], button:has-text("Send")')
        .first();
      if (await sendWithout.count()) {
        await sendWithout.click();
        await humanDelay();
      }
      // Acceptance happens later — reflected via IS_CONNECTED / checkReply.
      return { ok: true, detail: "接続リクエストを送信しました（承認待ち）" };
    });
  }

  private async message(req: ActionRequest): Promise<ActionResult> {
    const text = (req.body ?? "").trim();
    if (!text) return { ok: false, detail: "本文が空です" };

    return withPage(async (page) => {
      if (!(await this.gotoProfile(page, req.lead)))
        return { ok: false, detail: "プロフィールURLが不正です" };

      const msgBtn = page
        .locator('button:has-text("メッセージ"), button[aria-label*="メッセージ"], a:has-text("Message"), button:has-text("Message")')
        .first();
      if ((await msgBtn.count()) === 0)
        return { ok: false, detail: "メッセージボタンが見つかりません（未接続の可能性）" };

      await msgBtn.click();
      await humanDelay(800, 1800);

      const editor = page.locator('div.msg-form__contenteditable, div[role="textbox"][contenteditable="true"]').first();
      if ((await editor.count()) === 0) return { ok: false, detail: "メッセージ入力欄が見つかりません" };

      if (this.dryRun()) return { ok: true, detail: "[dry-run] メッセージ（送信せず）" };

      await editor.click();
      await editor.type(text, { delay: 30 + Math.random() * 40 });
      await humanDelay(500, 1200);

      const send = page.locator('button.msg-form__send-button, button:has-text("送信"), button:has-text("Send")').first();
      if ((await send.count()) === 0) return { ok: false, detail: "送信ボタンが見つかりません" };
      await send.click();
      await humanDelay();

      return { ok: true, detail: "メッセージを送信しました", message: { body: text, channel: "linkedin" } };
    });
  }

  private async follow(req: ActionRequest): Promise<ActionResult> {
    return withPage(async (page) => {
      if (!(await this.gotoProfile(page, req.lead)))
        return { ok: false, detail: "プロフィールURLが不正です" };
      const follow = page.locator('button:has-text("フォロー"), button[aria-label*="フォロー"], button:has-text("Follow")').first();
      if ((await follow.count()) === 0) return { ok: false, detail: "フォローボタンが見つかりません" };
      if (this.dryRun()) return { ok: true, detail: "[dry-run] フォロー（実行せず）" };
      await follow.click();
      await humanDelay();
      return { ok: true, detail: "フォローしました" };
    });
  }

  private async likePost(req: ActionRequest): Promise<ActionResult> {
    const url = this.profileUrl(req.lead);
    if (!url) return { ok: false, detail: "プロフィールURLが不正です" };
    return withPage(async (page) => {
      await page.goto(url.replace(/\/$/, "") + "/recent-activity/all/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await humanDelay(1000, 2200);
      const like = page.locator('button[aria-label*="いいね"], button[aria-label*="Like"]').first();
      if ((await like.count()) === 0) return { ok: false, detail: "投稿が見つかりません" };
      if (this.dryRun()) return { ok: true, detail: "[dry-run] いいね（実行せず）" };
      await like.click();
      await humanDelay();
      return { ok: true, detail: "最新の投稿に「いいね」しました" };
    });
  }

  private async withdraw(req: ActionRequest): Promise<ActionResult> {
    // Withdrawing a specific pending invitation requires matching the lead on
    // the sent-invitations page; left as best-effort for now.
    void req;
    return { ok: true, detail: "接続リクエストの取り消しは手動対応が必要です（スキップ）" };
  }

  async evaluate(req: ConditionRequest): Promise<boolean> {
    if (!isConfigured()) return false;
    try {
      switch (req.conditionType) {
        case "IS_CONNECTED":
          return await this.isConnected(req.lead);
        case "IS_OPEN_PROFILE":
        case "MESSAGE_SEEN":
        case "HAS_EMAIL":
          // Best-effort: not reliably detectable via the public DOM yet.
          return false;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  private async isConnected(lead: LeadContext): Promise<boolean> {
    const url = this.profileUrl(lead);
    if (!url) return false;
    return withPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await humanDelay(800, 1600);
      // 1st-degree connections show a "Message" primary action and a "1st"
      // distance badge; not-connected show "Connect".
      const messageBtn = await page
        .locator('button:has-text("メッセージ"), button:has-text("Message")')
        .count();
      const firstBadge = await page
        .locator(':text("1st"), :text("1次")')
        .count();
      return messageBtn > 0 && firstBadge > 0;
    });
  }

  async checkReply(lead: LeadContext): Promise<ReplyCheck> {
    if (!isConfigured()) return { replied: false };
    // A robust implementation opens the conversation thread and inspects the
    // latest inbound bubble. Mapping a profile to its thread reliably needs the
    // messaging search; conservatively report no new reply until implemented.
    void lead;
    return { replied: false };
  }
}
