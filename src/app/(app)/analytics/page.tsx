import Link from "next/link";
import { getCurrentTeamId } from "@/lib/session";
import { teamAnalytics } from "@/lib/analytics";
import { Card, Stat, Badge, PageHeader } from "@/components/ui";
import { TrendChart } from "@/components/analytics/TrendChart";
import { FunnelBars, BreakdownBars } from "@/components/analytics/Bars";

export const dynamic = "force-dynamic";

const PERIODS = [7, 14, 30, 90];

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = PERIODS.includes(Number(daysParam)) ? Number(daysParam) : 30;
  const teamId = await getCurrentTeamId();
  const a = await teamAnalytics(teamId, days);

  return (
    <div>
      <PageHeader
        title="分析"
        subtitle={`直近 ${days} 日間の成果指標`}
        action={
          <a href={`/api/analytics/export?days=${days}`} className="btn-ghost">
            CSVエクスポート
          </a>
        }
      />

      <div className="mb-6 flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/analytics?days=${p}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              p === days ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {p}日
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="接続リクエスト" value={a.summary.connectionsSent} />
        <Stat
          label="接続承認率"
          value={pct(a.summary.acceptanceRate)}
          sub={`${a.summary.connectionsAccepted} 承認`}
        />
        <Stat label="メッセージ送信" value={a.summary.messagesSent} />
        <Stat label="返信率" value={pct(a.summary.replyRate)} sub={`${a.summary.replies} 返信`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">日次トレンド</h2>
          <TrendChart data={a.daily} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">ファネル</h2>
          <FunnelBars stages={a.funnel} />
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">チャネル別メッセージ</h2>
          <BreakdownBars items={a.channels} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">アクション別内訳</h2>
          <BreakdownBars items={a.actions} />
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">キャンペーン比較</h2>
        <Card>
          {a.campaigns.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">キャンペーンがありません。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-4 py-2 font-medium">キャンペーン</th>
                    <th className="px-4 py-2 font-medium">状態</th>
                    <th className="px-4 py-2 font-medium">リード</th>
                    <th className="px-4 py-2 font-medium">接続送信</th>
                    <th className="px-4 py-2 font-medium">承認率</th>
                    <th className="px-4 py-2 font-medium">メッセージ</th>
                    <th className="px-4 py-2 font-medium">返信率</th>
                  </tr>
                </thead>
                <tbody>
                  {a.campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><Badge>{c.status}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{c.leads}</td>
                      <td className="px-4 py-3 text-slate-500">{c.connectionsSent}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{pct(c.acceptanceRate)}</td>
                      <td className="px-4 py-3 text-slate-500">{c.messagesSent}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{pct(c.replyRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {a.variants.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">A/Bバリアント比較</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-4 py-2 font-medium">シーケンス</th>
                    <th className="px-4 py-2 font-medium">ステップ</th>
                    <th className="px-4 py-2 font-medium">バリアント</th>
                    <th className="px-4 py-2 font-medium">送信</th>
                    <th className="px-4 py-2 font-medium">返信</th>
                    <th className="px-4 py-2 font-medium">返信率</th>
                  </tr>
                </thead>
                <tbody>
                  {a.variants.map((v, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 text-slate-600">{v.sequence}</td>
                      <td className="px-4 py-3 text-slate-500">#{v.node}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          {v.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{v.sent}</td>
                      <td className="px-4 py-3 text-slate-500">{v.replied}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{pct(v.replyRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
