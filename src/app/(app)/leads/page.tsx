import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { createLead } from "@/lib/actions";
import { Card, PageHeader, Tag, EmptyState } from "@/components/ui";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  LINKEDIN_SEARCH: "LinkedIn検索",
  SALES_NAVIGATOR: "Sales Navigator",
  RECRUITER: "Recruiter",
  EVENT_ATTENDEES: "イベント参加者",
  POST_LIKERS: "投稿いいね",
  POST_COMMENTERS: "投稿コメント",
  FIRST_CONNECTIONS: "1次接続",
  PROFILE_URL: "プロフィールURL",
  CSV_IMPORT: "CSV取込",
  MANUAL: "手動",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const teamId = await getCurrentTeamId();

  const where: Prisma.LeadWhereInput = { teamId };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
      { headline: { contains: q, mode: "insensitive" } },
    ];
  }
  if (tag) {
    where.tags = { some: { tag: { name: tag } } };
  }

  const [leads, tags, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { tags: { include: { tag: true } }, _count: { select: { campaignLeads: true } } },
    }),
    prisma.tag.findMany({ where: { teamId }, orderBy: { name: "asc" } }),
    prisma.lead.count({ where: { teamId } }),
  ]);

  return (
    <div>
      <PageHeader
        title="リード管理"
        subtitle={`簡易CRM · 全 ${total} 件`}
        action={
          <Link href="/leads/import" className="btn-primary">
            ＋ リードを取り込む
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form className="mb-4 flex gap-2" action="/leads">
            <input
              name="q"
              defaultValue={q ?? ""}
              className="input"
              placeholder="名前・会社・役職・キーワードで検索"
            />
            <button className="btn-ghost" type="submit">
              検索
            </button>
          </form>

          {tags.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link
                href="/leads"
                className={`text-xs ${!tag ? "font-semibold text-brand-600" : "text-slate-400"}`}
              >
                すべて
              </Link>
              {tags.map((t) => (
                <Link key={t.id} href={`/leads?tag=${encodeURIComponent(t.name)}`}>
                  <Tag name={t.name} color={t.color} />
                </Link>
              ))}
            </div>
          ) : null}

          {leads.length === 0 ? (
            <EmptyState title="該当するリードがありません" />
          ) : (
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-4 py-2 font-medium">リード</th>
                    <th className="px-4 py-2 font-medium">会社 / 役職</th>
                    <th className="px-4 py-2 font-medium">ソース</th>
                    <th className="px-4 py-2 font-medium">タグ</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                          {l.firstName} {l.lastName}
                        </Link>
                        {l.blacklisted ? (
                          <span className="ml-2 text-xs text-red-500">ブラックリスト</span>
                        ) : null}
                        <div className="text-xs text-slate-400">{l.email ?? "メール未取得"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <div>{l.company ?? "—"}</div>
                        <div className="text-xs text-slate-400">{l.jobTitle}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {SOURCE_LABEL[l.source] ?? l.source}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {l.tags.map((lt) => (
                            <Tag key={lt.tagId} name={lt.tag.name} color={lt.tag.color} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">リードを追加</h2>
            <form action={createLead} className="space-y-3">
              <div>
                <label className="label">氏名（敬称・絵文字は自動除去）</label>
                <input name="name" required className="input" placeholder="Dr. 山田 太郎 🎯" />
              </div>
              <div>
                <label className="label">会社</label>
                <input name="company" className="input" />
              </div>
              <div>
                <label className="label">役職</label>
                <input name="jobTitle" className="input" />
              </div>
              <div>
                <label className="label">所在地</label>
                <input name="location" className="input" />
              </div>
              <div>
                <label className="label">プロフィールURL</label>
                <input name="profileUrl" className="input" placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <label className="label">ソース</label>
                <select name="source" className="input">
                  {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full">
                追加する
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
