import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { updateDailyLimits, createWebhook } from "@/lib/actions";
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
  const [limits, connections, webhooks] = await Promise.all([
    prisma.dailyLimit.findUnique({ where: { teamId } }),
    prisma.accountConnection.findMany({ where: { teamId } }),
    prisma.webhook.findMany({ where: { teamId } }),
  ]);

  const limitVal = (name: string, def: number) =>
    limits ? (limits as unknown as Record<string, number>)[name] ?? def : def;

  return (
    <div>
      <PageHeader title="設定" subtitle="上限・稼働時間・連携・Webhook" />

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
              外部システムへイベントを連携します（カンマ区切りでイベント指定）。
            </p>
            {webhooks.length > 0 ? (
              <div className="mb-3 space-y-2">
                {webhooks.map((w) => (
                  <div key={w.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <div className="truncate font-medium text-slate-700">{w.url}</div>
                    <div className="text-xs text-slate-400">{w.events.join(", ") || "全イベント"}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <form action={createWebhook} className="space-y-2">
              <input name="url" className="input" placeholder="https://example.com/webhook" />
              <input
                name="events"
                className="input"
                placeholder="connection.accepted, message.replied"
              />
              <button type="submit" className="btn-ghost w-full">
                Webhookを追加
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
