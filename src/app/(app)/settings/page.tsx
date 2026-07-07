import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { updateDailyLimits } from "@/lib/actions";
import { inviteMemberAction } from "@/lib/auth/actions";
import { WorkingHoursEditor, RunNowButton } from "@/components/SchedulerControls";
import { WebhookManager } from "@/components/WebhookManager";
import { isWithinWorkingHours } from "@/lib/schedule";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const CONNECTION_LABEL: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  SALES_NAVIGATOR: "Sales Navigator",
  RECRUITER: "Recruiter",
  GMAIL: "Gmail",
  SMTP: "SMTP",
};

const LIMIT_FIELDS: { name: string; label: string; def: number }[] = [
  { name: "maxConnectionRequests", label: "接続リクエスト", def: 20 },
  { name: "maxMessages", label: "メッセージ", def: 50 },
  { name: "maxInmails", label: "InMail", def: 10 },
  { name: "maxProfileViews", label: "プロフィール閲覧", def: 100 },
  { name: "maxEndorsements", label: "スキル推薦", def: 20 },
  { name: "maxLikes", label: "いいね", def: 30 },
  { name: "maxFollows", label: "フォロー", def: 30 },
  { name: "maxEmails", label: "メール送信", def: 50 },
];

export default async function SettingsPage() {
  const teamId = await getCurrentTeamId();
  const [limits, connections, webhooks, members] = await Promise.all([
    prisma.dailyLimit.findUnique({ where: { teamId } }),
    prisma.accountConnection.findMany({ where: { teamId } }),
    prisma.webhook.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    prisma.membership.findMany({
      where: { teamId },
      include: { user: true },
      orderBy: { role: "asc" },
    }),
  ]);

  const limitVal = (name: string, def: number) =>
    limits ? (limits as unknown as Record<string, number>)[name] ?? def : def;

  const timezone = limits?.timezone ?? "Asia/Tokyo";
  const workingHours =
    (limits?.workingHours as { enabled: boolean; start: string; end: string }[] | null) ?? null;
  const schedulerActive = isWithinWorkingHours(limits?.workingHours, timezone);
  const inProcess = process.env.ENABLE_INPROCESS_SCHEDULER === "true";

  return (
    <div>
      <PageHeader title="設定" subtitle="メンバー・上限・稼働時間・連携・Webhook" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">1日あたりの上限</h2>
          <p className="mb-4 text-xs text-slate-400">
            自動化による過剰なアクションを防ぐための上限を設定します。
          </p>
          <form action={updateDailyLimits} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {LIMIT_FIELDS.map((f) => (
                <div key={f.name}>
                  <label className="label">{f.label}</label>
                  <input
                    name={f.name}
                    type="number"
                    min={0}
                    defaultValue={limitVal(f.name, f.def)}
                    className="input"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="label">タイムゾーン</label>
              <input name="timezone" defaultValue={limits?.timezone ?? "Asia/Tokyo"} className="input" />
            </div>
            <button type="submit" className="btn-primary">
              保存する
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">連携アカウント</h2>
            {connections.length === 0 ? (
              <p className="text-sm text-slate-400">連携済みアカウントはありません。</p>
            ) : (
              <div className="space-y-2">
                {connections.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        {CONNECTION_LABEL[c.type] ?? c.type}
                      </div>
                      <div className="text-xs text-slate-400">{c.displayName}</div>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">Webhook</h2>
            <p className="mb-3 text-xs text-slate-400">
              イベント発生時に外部システムへ署名付きでPOST配信します。
            </p>
            <WebhookManager
              webhooks={webhooks.map((w) => ({
                id: w.id,
                url: w.url,
                events: w.events,
                active: w.active,
                secret: w.secret,
                deliveries: w.deliveries.map((d) => ({
                  id: d.id,
                  event: d.event,
                  statusCode: d.statusCode,
                  success: d.success,
                  createdAt: d.createdAt.toISOString(),
                })),
              }))}
            />
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">自動実行スケジューラ</h2>
            <p className="mt-1 text-xs text-slate-400">
              稼働中キャンペーンを稼働時間内で自動進行します。手動で今すぐ実行することもできます。
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              schedulerActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {schedulerActive ? "稼働時間内" : "稼働時間外"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium text-slate-500">曜日ごとの稼働時間</h3>
            <WorkingHoursEditor initial={workingHours} timezone={timezone} />
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-100 p-3 text-xs text-slate-500">
              <div className="mb-1 font-medium text-slate-600">自動実行の設定方法</div>
              <ul className="list-disc space-y-1 pl-4">
                <li>Vercel: <code>vercel.json</code> の cron が <code>/api/cron/run</code> を定期実行</li>
                <li>セルフホスト: <code>ENABLE_INPROCESS_SCHEDULER=true</code> で常駐実行</li>
                <li>ローカル: <code>npm run scheduler</code> でポーリング実行</li>
              </ul>
              <div className="mt-2">
                インプロセス常駐: {inProcess ? "有効" : "無効"}
              </div>
            </div>
            <RunNowButton />
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">チームメンバー</h2>
        <p className="mb-4 text-xs text-slate-400">
          複数メンバーでの共同運用。登録済みユーザーのメールアドレスで招待できます。
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-slate-700">{m.user.name}</div>
                  <div className="text-xs text-slate-400">{m.user.email}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
          <form action={inviteMemberAction} className="space-y-2">
            <div>
              <label className="label">招待するメールアドレス</label>
              <input name="email" type="email" className="input" placeholder="member@company.com" />
            </div>
            <div>
              <label className="label">権限</label>
              <select name="role" className="input">
                <option value="MEMBER">メンバー</option>
                <option value="ADMIN">管理者</option>
              </select>
            </div>
            <button type="submit" className="btn-ghost w-full">
              メンバーを招待
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
