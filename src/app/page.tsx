import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { Card, Stat, Badge, PageHeader, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function DashboardPage() {
  const teamId = await getCurrentTeamId();

  const [campaigns, leadCount, activeCampaigns, connSent, connAccepted, msgSent, replies, recent] =
    await Promise.all([
      prisma.campaign.findMany({
        where: { teamId },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { leads: true } } },
      }),
      prisma.lead.count({ where: { teamId } }),
      prisma.campaign.count({ where: { teamId, status: "RUNNING" } }),
      prisma.activityLog.count({ where: { teamId, actionType: "CONNECT_REQUEST", status: "success" } }),
      prisma.campaignLead.count({ where: { campaign: { teamId }, connectionAccepted: true } }),
      prisma.activityLog.count({
        where: { teamId, actionType: { in: ["MESSAGE", "INMAIL"] }, status: "success" },
      }),
      prisma.campaignLead.count({ where: { campaign: { teamId }, replied: true } }),
      prisma.activityLog.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { lead: true },
      }),
    ]);

  const acceptanceRate = connSent > 0 ? connAccepted / connSent : 0;
  const replyRate = msgSent > 0 ? replies / msgSent : 0;

  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        subtitle="全キャンペーン横断の成果サマリー"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="リード総数" value={leadCount} />
        <Stat label="稼働中キャンペーン" value={activeCampaigns} sub={`全 ${campaigns.length} 件`} />
        <Stat label="接続承認率" value={pct(acceptanceRate)} sub={`${connAccepted} / ${connSent}`} />
        <Stat label="返信率" value={pct(replyRate)} sub={`${replies} / ${msgSent}`} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">キャンペーン</h2>
          <Card>
            {campaigns.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">
                キャンペーンがありません。
                <Link href="/campaigns" className="ml-1 text-brand-600 hover:underline">
                  作成する
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-4 py-2 font-medium">名前</th>
                    <th className="px-4 py-2 font-medium">状態</th>
                    <th className="px-4 py-2 font-medium">リード</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{c._count.leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="mb-2 text-xs font-medium text-slate-500">接続承認率</div>
              <ProgressBar value={acceptanceRate} />
              <div className="mt-2 text-lg font-semibold">{pct(acceptanceRate)}</div>
            </Card>
            <Card className="p-4">
              <div className="mb-2 text-xs font-medium text-slate-500">返信率</div>
              <ProgressBar value={replyRate} />
              <div className="mt-2 text-lg font-semibold">{pct(replyRate)}</div>
            </Card>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">最近のアクティビティ</h2>
          <Card className="divide-y divide-slate-50">
            {recent.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">まだアクティビティはありません。</div>
            ) : (
              recent.map((a) => (
                <div key={a.id} className="flex items-start gap-2 px-4 py-3">
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                      a.status === "success" ? "bg-green-500" : "bg-red-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-700">{a.detail}</div>
                    <div className="text-xs text-slate-400">
                      {a.lead ? `${a.lead.firstName} ${a.lead.lastName} · ` : ""}
                      {a.createdAt.toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
