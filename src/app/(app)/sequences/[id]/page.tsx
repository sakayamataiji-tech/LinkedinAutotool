import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import {
  AddNodeForm,
  DeleteNodeButton,
  ACTION_LABELS,
  CONDITION_LABELS,
} from "@/components/SequenceBuilder";
import { VariantManager } from "@/components/VariantManager";
import { sequenceVariantStats } from "@/lib/ab";

export const dynamic = "force-dynamic";

const KIND_STYLE: Record<string, { ring: string; badge: string; icon: string }> = {
  ACTION: { ring: "border-brand-200", badge: "bg-brand-50 text-brand-700", icon: "▶" },
  DELAY: { ring: "border-amber-200", badge: "bg-amber-50 text-amber-700", icon: "⏱" },
  CONDITION: { ring: "border-purple-200", badge: "bg-purple-50 text-purple-700", icon: "◇" },
};

function nodeTitle(node: {
  kind: string;
  actionType: string | null;
  delayMinutes: number | null;
  conditionType: string | null;
}) {
  if (node.kind === "ACTION") return ACTION_LABELS[node.actionType ?? ""] ?? node.actionType;
  if (node.kind === "DELAY") {
    const m = node.delayMinutes ?? 0;
    return m >= 1440 ? `${Math.round(m / 1440)}日 待機` : m >= 60 ? `${Math.round(m / 60)}時間 待機` : `${m}分 待機`;
  }
  if (node.kind === "CONDITION") return `条件: ${CONDITION_LABELS[node.conditionType ?? ""] ?? ""}`;
  return node.kind;
}

export default async function SequenceBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();

  const sequence = await prisma.sequence.findFirst({
    where: { id, teamId },
    include: {
      nodes: { orderBy: { order: "asc" }, include: { variants: { orderBy: { label: "asc" } } } },
      campaign: true,
    },
  });
  if (!sequence) notFound();

  const [templates, abStats] = await Promise.all([
    prisma.messageTemplate.findMany({ where: { teamId }, orderBy: { name: "asc" } }),
    sequenceVariantStats(sequence.id),
  ]);
  const statsByNode = new Map(abStats.map((s) => [s.nodeId, s.variants]));
  const MESSAGE_ACTIONS = new Set(["MESSAGE", "INMAIL", "SEND_EMAIL"]);

  return (
    <div>
      <div className="mb-2">
        <Link href="/sequences" className="text-xs text-slate-400 hover:text-slate-600">
          ← シーケンス一覧
        </Link>
      </div>
      <PageHeader
        title={sequence.name}
        subtitle={sequence.description ?? "アクション・待機・条件分岐を組み合わせてフローを構築"}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sequence.nodes.length === 0 ? (
            <Card className="p-10 text-center text-sm text-slate-400">
              まだステップがありません。右のパネルから追加してください。
            </Card>
          ) : (
            <div className="relative">
              {sequence.nodes.map((node, i) => {
                const style = KIND_STYLE[node.kind];
                return (
                  <div key={node.id}>
                    <Card className={`border-l-4 p-4 ${style.ring}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${style.badge}`}
                          >
                            {style.icon}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-slate-800">
                              {i + 1}. {nodeTitle(node)}
                            </div>
                            {node.messageBody && node.variants.length === 0 ? (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                                {node.messageBody}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <DeleteNodeButton nodeId={node.id} sequenceId={sequence.id} />
                      </div>
                      {node.kind === "ACTION" && MESSAGE_ACTIONS.has(node.actionType ?? "") ? (
                        <VariantManager
                          nodeId={node.id}
                          variants={(statsByNode.get(node.id) ?? []).map((v) => ({
                            id: v.id,
                            label: v.label,
                            body: v.body,
                            subject: v.subject,
                            sent: v.sent,
                            recipients: v.recipients,
                            replied: v.replied,
                            replyRate: v.replyRate,
                          }))}
                        />
                      ) : null}
                    </Card>
                    {i < sequence.nodes.length - 1 ? (
                      <div className="ml-[27px] h-6 w-px bg-slate-200" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">ステップを追加</h2>
            <AddNodeForm
              sequenceId={sequence.id}
              templates={templates.map((t) => ({
                id: t.id,
                name: t.name,
                subject: t.subject,
                body: t.body,
              }))}
            />
            <p className="mt-3 text-xs text-slate-400">
              メッセージ系ステップは追加後、A/Bテストのバリアントを設定できます。
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
