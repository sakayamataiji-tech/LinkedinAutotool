import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { createSequence } from "@/lib/actions";
import { Card, PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const teamId = await getCurrentTeamId();
  const sequences = await prisma.sequence.findMany({
    where: { teamId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { nodes: true } }, campaign: true },
  });

  return (
    <div>
      <PageHeader title="メッセージの流れ" subtitle="接続リクエストからメッセージ・フォローまでの送信ステップです" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sequences.length === 0 ? (
            <EmptyState title="メッセージの流れがありません" hint="右のフォームから作成できます" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sequences.map((s) => (
                <Link key={s.id} href={`/sequences/${s.id}`}>
                  <Card className="p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-800">{s.name}</div>
                      {s.isTemplate ? (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">
                          テンプレート
                        </span>
                      ) : null}
                    </div>
                    {s.description ? (
                      <p className="mt-1 text-xs text-slate-400">{s.description}</p>
                    ) : null}
                    <div className="mt-3 text-xs text-slate-400">
                      {s._count.nodes} ステップ
                      {s.campaign ? ` · ${s.campaign.name}` : ""}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">新しいメッセージの流れ</h2>
            <form action={createSequence} className="space-y-3">
              <div>
                <label className="label">名前</label>
                <input name="name" required className="input" placeholder="標準アウトリーチ" />
              </div>
              <div>
                <label className="label">説明</label>
                <input name="description" className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="isTemplate" />
                テンプレートとして保存
              </label>
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
