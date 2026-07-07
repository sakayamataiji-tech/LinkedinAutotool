import type {
  ActionRequest,
  ActionResult,
  ConditionRequest,
  LinkedInProvider,
} from "./provider";

/**
 * Deterministic mock provider.
 *
 * Simulates realistic LinkedIn/email outcomes so the whole product (campaigns,
 * sequences, inbox, analytics) is exercisable end-to-end without a real
 * LinkedIn account. Outcomes are derived from a hash of the lead id so a given
 * lead behaves consistently across runs.
 */
export class MockLinkedInProvider implements LinkedInProvider {
  readonly name = "mock";

  private hash(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // map to [0,1)
    return ((h >>> 0) % 1000) / 1000;
  }

  async execute(req: ActionRequest): Promise<ActionResult> {
    const { actionType, lead } = req;
    const roll = this.hash(lead.leadId + actionType);

    switch (actionType) {
      case "CONNECT_REQUEST": {
        // ~65% of requests eventually get accepted in the mock world.
        const accepted = roll < 0.65;
        return {
          ok: true,
          detail: accepted
            ? "接続リクエストを送信し、承認されました"
            : "接続リクエストを送信しました（承認待ち）",
          patch: accepted ? { isConnected: true } : undefined,
        };
      }
      case "MESSAGE":
        return {
          ok: true,
          detail: "メッセージを送信しました",
          message: { body: req.body ?? "", channel: "linkedin" },
        };
      case "INMAIL":
        return {
          ok: true,
          detail: "InMailを送信しました",
          message: { body: req.body ?? "", channel: "inmail" },
        };
      case "VIEW_PROFILE":
        return { ok: true, detail: "プロフィールを閲覧しました" };
      case "ENDORSE_SKILL":
        return { ok: true, detail: "スキルを推薦しました" };
      case "FOLLOW":
        return { ok: true, detail: "フォローしました" };
      case "LIKE_POST":
        return { ok: true, detail: "最新の投稿に「いいね」しました" };
      case "FIND_EMAIL": {
        const found = roll < 0.7;
        if (found) {
          const email =
            lead.email ??
            `${lead.firstName}.${lead.lastName}`.toLowerCase().replace(/[^a-z.]/g, "") +
              "@" +
              (lead.company ?? "example").toLowerCase().replace(/[^a-z]/g, "") +
              ".com";
          return {
            ok: true,
            detail: `メールアドレスを取得しました: ${email}`,
            patch: { email, emailStatus: "found" },
          };
        }
        return {
          ok: true,
          detail: "メールアドレスを取得できませんでした",
          patch: { emailStatus: "not_found" },
        };
      }
      case "SEND_EMAIL": {
        if (!lead.email) {
          return { ok: false, detail: "メールアドレス未取得のため送信をスキップ" };
        }
        return {
          ok: true,
          detail: `メールを送信しました (${lead.email})`,
          message: { body: req.body ?? "", channel: "email" },
        };
      }
      case "WITHDRAW_REQUEST":
        return { ok: true, detail: "未承認の接続リクエストを取り消しました" };
      default:
        return { ok: false, detail: "未対応のアクション" };
    }
  }

  async evaluate(req: ConditionRequest): Promise<boolean> {
    const { conditionType, lead } = req;
    switch (conditionType) {
      case "IS_CONNECTED":
        return lead.isConnected;
      case "HAS_EMAIL":
        return Boolean(lead.email);
      case "IS_OPEN_PROFILE":
        return lead.isOpenProfile;
      case "MESSAGE_SEEN":
        // ~55% of sent messages have been seen in the mock world.
        return this.hash(lead.leadId + "seen") < 0.55;
      default:
        return false;
    }
  }
}
