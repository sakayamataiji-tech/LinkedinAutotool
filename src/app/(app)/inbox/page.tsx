import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { FlagButtons, ReplyBox, SimulateReplyButton } from "@/components/InboxControls";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "すべて" },
  { key: "unread", label: "未読" },
  { key: "replied", label: "返信あり" },
  { key: "important", label: "重要" },
  { key: "archived", label: "アーカイブ" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; filter?: string }>;
}) {
  const { c, filter = "all" } = await searchParams;
  const teamId = await getCurrentTeamId();

  const where: Prisma.ConversationWhereInput = { lead: { teamId } };
  if (filter === "unread") where.unread = true;
  else if (filter === "important") where.important = true;
  else if (filter === "archived") where.archived = true;
  else if (filter === "replied") where.messages = { some: { direction: "INBOUND" } };
  else where.archived = false;

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      lead: true,
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
  });

  const selectedId = c ?? conversations[0]?.id;
  const selected = selectedId
    ? await prisma.conversation.findFirst({
        where: { id: selectedId, lead: { teamId } },
        include: { lead: true, messages: { orderBy: { sentAt: "asc" } } },
      })
    : null;

  return (
    <div>
      <PageHeader title="受信箱" subtitle="LinkedInメッセージを一元管理" />

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/inbox?filter=${f.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === f.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="max-h-[70vh] overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">会話がありません。</div>
          ) : (
            conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/inbox?filter=${filter}&c=${conv.id}`}
                className={`block border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50 ${
                  conv.id === selectedId ? "bg-brand-50/50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    {conv.lead.firstName} {conv.lead.lastName}
                  </span>
                  <div className="flex items-center gap-1">
                    {conv.important ? <span className="text-amber-500">★</span> : null}
                    {conv.unread ? <span className="h-2 w-2 rounded-full bg-brand-500" /> : null}
                  </div>
                </div>
                <div className="truncate text-xs text-slate-400">
                  {conv.messages[0]?.body ?? "（メッセージなし）"}
                </div>
                <div className="mt-0.5 text-[10px] uppercase text-slate-300">{conv.channel}</div>
              </Link>
            ))
          )}
        </Card>

        <Card className="flex flex-col lg:col-span-2">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-400">
              会話を選択してください
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div>
                  <Link
                    href={`/leads/${selected.lead.id}`}
                    className="text-sm font-semibold text-slate-800 hover:text-brand-600"
                  >
                    {selected.lead.firstName} {selected.lead.lastName}
                  </Link>
                  <div className="text-xs text-slate-400">
                    {selected.lead.jobTitle} {selected.lead.company ? `@ ${selected.lead.company}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SimulateReplyButton leadId={selected.lead.id} />
                  <FlagButtons
                    conversationId={selected.id}
                    important={selected.important}
                    archived={selected.archived}
                  />
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "48vh" }}>
                {selected.messages.length === 0 ? (
                  <p className="text-sm text-slate-400">メッセージはありません。</p>
                ) : (
                  selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          m.direction === "OUTBOUND"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {m.body}
                        <div
                          className={`mt-1 text-[10px] ${
                            m.direction === "OUTBOUND" ? "text-brand-100" : "text-slate-400"
                          }`}
                        >
                          {m.sentAt.toLocaleString("ja-JP", {
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
              </div>

              <ReplyBox conversationId={selected.id} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
