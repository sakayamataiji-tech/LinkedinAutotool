import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { sequenceVariantStats } from "@/lib/ab";
import { SequenceTemplate, type TemplateStep } from "@/components/SequenceTemplate";

export const dynamic = "force-dynamic";

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

  const abStats = await sequenceVariantStats(sequence.id);
  const statsByNode = new Map(abStats.map((s) => [s.nodeId, s.variants]));

  const steps: TemplateStep[] = sequence.nodes.map((node) => ({
    id: node.id,
    kind: node.kind as TemplateStep["kind"],
    actionType: node.actionType,
    conditionType: node.conditionType,
    delayMinutes: node.delayMinutes,
    messageBody: node.messageBody,
    variants: (statsByNode.get(node.id) ?? []).map((v) => ({
      id: v.id,
      label: v.label,
      body: v.body,
      subject: v.subject,
      sent: v.sent,
      recipients: v.recipients,
      replied: v.replied,
      replyRate: v.replyRate,
    })),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2">
        <Link href="/sequences" className="text-xs text-slate-400 hover:text-slate-600">
          ← メッセージの流れ一覧
        </Link>
      </div>
      <PageHeader
        title={sequence.name}
        subtitle="送信される文面（メッセージ）を編集できます。ステップの流れは自動で設定済みです。"
      />

      <SequenceTemplate steps={steps} />
    </div>
  );
}
