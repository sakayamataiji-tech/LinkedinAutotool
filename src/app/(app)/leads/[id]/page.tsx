import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { Card, Badge, Tag, PageHeader } from "@/components/ui";
import { BlacklistButton, NotesEditor } from "@/components/LeadControls";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value || "—"}</span>
    </div>
  );
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();

  const lead = await prisma.lead.findFirst({
    where: { id, teamId },
    include: {
      tags: { include: { tag: true } },
      campaignLeads: { include: { campaign: true }, orderBy: { updatedAt: "desc" } },
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
      activities: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!lead) notFound();

  return (
    <div>
      <div className="mb-2">
        <Link href="/leads" className="text-xs text-slate-400 hover:text-slate-600">
          ← リード一覧
        </Link>
      </div>
      <PageHeader
        title={`${lead.firstName} ${lead.lastName}`}
        subtitle={lead.headline ?? `${lead.jobTitle ?? ""}${lead.company ? ` @ ${lead.company}` : ""}`}
        action={<BlacklistButton leadId={lead.id} blacklisted={lead.blacklisted} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {lead.isConnected ? <Badge>IN_PROGRESS</Badge> : null}
        {lead.blacklisted ? <Badge>BLACKLISTED</Badge> : null}
        {lead.campaignLeads.some((cl) => cl.replied) ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            返信あり · 自動停止
          </span>
        ) : null}
        {lead.tags.map((lt) => (
          <Tag key={lt.tagId} name={lt.tag.name} color={lt.tag.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">プロフィール</h2>
            <Field label="会社" value={lead.company} />
            <Field label="役職" value={lead.jobTitle} />
            <Field label="所在地" value={lead.location} />
            <Field
              label="Webサイト"
              value={lead.website ? <a className="text-brand-600" href={lead.website}>{lead.website}</a> : null}
            />
            <Field
              label="プロフィール"
              value={
                lead.profileUrl ? (
                  <a className="text-brand-600" href={lead.profileUrl} target="_blank" rel="noreferrer">
                    開く
                  </a>
                ) : null
              }
            />
            <Field
              label="メール"
              value={
                lead.email ? (
                  <span>
                    {lead.email}{" "}
                    <span className="text-xs text-slate-400">({lead.emailStatus})</span>
                  </span>
                ) : (
                  <span className="text-slate-400">未取得</span>
                )
              }
            />
            <Field label="オープンプロフィール" value={lead.isOpenProfile ? "はい" : "いいえ"} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">メモ</h2>
            <NotesEditor leadId={lead.id} initial={lead.notes ?? ""} />
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">アプローチ施策の進捗履歴</h2>
            {lead.campaignLeads.length === 0 ? (
              <p className="text-sm text-slate-400">まだアプローチ施策に登録されていません。</p>
            ) : (
              <div className="space-y-2">
                {lead.campaignLeads.map((cl) => (
                  <div
                    key={cl.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <Link
                      href={`/campaigns/${cl.campaignId}`}
                      className="text-sm font-medium text-slate-700 hover:text-brand-600"
                    >
                      {cl.campaign.name}
                    </Link>
                    <Badge>{cl.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">アクティビティ履歴</h2>
            {lead.activities.length === 0 ? (
              <p className="text-sm text-slate-400">アクティビティはありません。</p>
            ) : (
              <div className="space-y-1.5">
                {lead.activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        a.status === "success" ? "bg-green-500" : "bg-red-400"
                      }`}
                    />
                    <div>
                      <span className="text-slate-700">{a.detail}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {a.createdAt.toLocaleString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
