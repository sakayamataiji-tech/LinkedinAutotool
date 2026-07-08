import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { sequenceVariantStats } from "@/lib/ab";
import { SequenceCanvas, type CanvasNode } from "@/components/SequenceCanvas";

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

  const [templates, abStats] = await Promise.all([
    prisma.messageTemplate.findMany({ where: { teamId }, orderBy: { name: "asc" } }),
    sequenceVariantStats(sequence.id),
  ]);
  const statsByNode = new Map(abStats.map((s) => [s.nodeId, s.variants]));

  const canvasNodes: CanvasNode[] = sequence.nodes.map((node) => ({
    id: node.id,
    kind: node.kind as CanvasNode["kind"],
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
    <div>
      <div className="mb-2">
        <Link href="/sequences" className="text-xs text-slate-400 hover:text-slate-600">
          ← シーケンス一覧
        </Link>
      </div>
      <PageHeader
        title={sequence.name}
        subtitle={sequence.description ?? "ドラッグ&ドロップで並べ替え・追加・削除ができます"}
      />

      <div className="mx-auto max-w-2xl">
        <SequenceCanvas
          sequenceId={sequence.id}
          nodes={canvasNodes}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            body: t.body,
          }))}
        />
      </div>
    </div>
  );
}
