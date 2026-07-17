import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { createCampaign } from "@/lib/actions";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const teamId = await getCurrentTeamId();
  const [campaigns, sequences] = await Promise.all([
    prisma.campaign.findMany({
      where: { teamId },
      orderBy: { updatedAt: "desc" },
      include: {
        sequence: true,
        _count: { select: { leads: true } },
      },
    }),
    prisma.sequence.findMany({ where: { teamId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="アプローチ施策" subtitle="誰に・どんな流れでアプローチするかをまとめて管理します" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {campaigns.length === 0 ? (
            <EmptyState title="アプローチ施策がありません" hint="右のフォームから作成できます" />
          ) : (
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-4 py-2 font-medium">名前</th>
                    <th className="px-4 py-2 font-medium">メッセージの流れ</th>
                    <th className="px-4 py-2 font-medium">状態</th>
                    <th className="px-4 py-2 font-medium">リード</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                          {c.name}
                        </Link>
                        {c.description ? (
                          <div className="text-xs text-slate-400">{c.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{c.sequence?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge>{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{c._count.leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">新しいアプローチ施策</h2>
            <form action={createCampaign} className="space-y-3">
              <div>
                <label className="label">名前</label>
                <input name="name" required className="input" placeholder="Q3 新規開拓" />
              </div>
              <div>
                <label className="label">説明</label>
                <input name="description" className="input" placeholder="任意" />
              </div>
              <div>
                <label className="label">メッセージの流れ</label>
                <select name="sequenceId" className="input">
                  <option value="">未選択</option>
                  {sequences.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full">
                作成する
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
