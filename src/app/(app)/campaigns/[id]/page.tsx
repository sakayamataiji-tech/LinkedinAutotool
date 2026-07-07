import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { computeCampaignMetrics, dailySeries } from "@/lib/metrics";
import { Card, Stat, Badge, PageHeader } from "@/components/ui";
import { CampaignControls } from "@/components/CampaignControls";
import { AddLeads } from "@/components/AddLeads";
import { DailyChart } from "@/components/DailyChart";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待機中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  PAUSED: "一時停止",
  FAILED: "失敗",
  BLACKLISTED: "ブラックリスト",
};

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();

  const campaign = await prisma.campaign.findFirst({
    where: { id, teamId },
    include: {
      sequence: { include: { nodes: true } },
      leads: { include: { lead: true }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!campaign) notFound();

  const [metrics, series, unassigned] = await Promise.all([
    computeCampaignMetrics(campaign.id),
    dailySeries(campaign.id),
    prisma.lead.findMany({
      where: { teamId, campaignLeads: { none: { campaignId: campaign.id } } },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <div className="mb-2">
        <Link href="/campaigns" className="text-xs text-slate-400 hover:text-slate-600">
          ← キャンペーン一覧
        </Link>
      </div>
      <PageHeader
        title={campaign.name}
        subtitle={campaign.sequence ? `シーケンス: ${campaign.sequence.name}` : "シーケンス未設定"}
        action={<CampaignControls campaignId={campaign.id} status={campaign.status} />}
      />

      <div className="mb-6 flex items-center gap-3">
        <Badge>{campaign.status}</Badge>
        {campaign.sequence ? (
          <Link
            href={`/sequences/${campaign.sequence.id}`}
            className="text-xs text-brand-600 hover:underline"
          >
            シーケンスを編集 →
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="対象リード" value={metrics.total} />
        <Stat
          label="接続承認率"
          value={`${Math.round(metrics.acceptanceRate * 100)}%`}
          sub={`${metrics.connectionsAccepted}/${metrics.connectionsSent}`}
        />
        <Stat
          label="返信率"
          value={`${Math.round(metrics.replyRate * 100)}%`}
          sub={`${metrics.repliesReceived}/${metrics.messagesSent}`}
        />
        <Stat label="メッセージ送信" value={metrics.messagesSent} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">日次アクティビティ推移</h2>
          <DailyChart data={series} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">ステータス内訳</h2>
          <div className="space-y-2">
            {Object.entries(metrics.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{STATUS_LABEL[status] ?? status}</span>
                <span className="font-medium text-slate-800">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            リード ({campaign.leads.length})
          </h2>
          <Card>
            {campaign.leads.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">まだリードが割り当てられていません。</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-4 py-2 font-medium">リード</th>
                    <th className="px-4 py-2 font-medium">状態</th>
                    <th className="px-4 py-2 font-medium">接続</th>
                    <th className="px-4 py-2 font-medium">次回実行</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.leads.map((cl) => (
                    <tr key={cl.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${cl.lead.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                          {cl.lead.firstName} {cl.lead.lastName}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {cl.lead.jobTitle} {cl.lead.company ? `@ ${cl.lead.company}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge>{cl.status}</Badge>
                          {cl.replied ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              返信あり
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {cl.connectionAccepted ? "✓ 承認" : cl.lead.isConnected ? "接続済" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {cl.nextRunAt
                          ? cl.nextRunAt.toLocaleString("ja-JP", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div>
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">リードを追加</h2>
            <AddLeads
              campaignId={campaign.id}
              candidates={unassigned.map((l) => ({
                id: l.id,
                name: `${l.firstName} ${l.lastName}`,
                company: l.company,
              }))}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
