import { prisma } from "./prisma";

/**
 * A/B test analytics. For each message node that has variants, computes how
 * many leads received each variant and how many of them replied.
 */
export interface VariantStat {
  id: string;
  label: string;
  body: string;
  subject: string | null;
  weight: number;
  sent: number;
  recipients: number;
  replied: number;
  replyRate: number;
}

export interface NodeVariantStats {
  nodeId: string;
  order: number;
  actionType: string | null;
  variants: VariantStat[];
}

export async function sequenceVariantStats(sequenceId: string): Promise<NodeVariantStats[]> {
  const nodes = await prisma.sequenceNode.findMany({
    where: { sequenceId, variants: { some: {} } },
    include: { variants: { orderBy: { label: "asc" } } },
    orderBy: { order: "asc" },
  });

  const out: NodeVariantStats[] = [];
  for (const node of nodes) {
    const variants: VariantStat[] = [];
    for (const v of node.variants) {
      const msgs = await prisma.message.findMany({
        where: { variantId: v.id, direction: "OUTBOUND" },
        select: { conversation: { select: { leadId: true } } },
      });
      const leadIds = [...new Set(msgs.map((m) => m.conversation.leadId))];
      const replied = leadIds.length
        ? await prisma.lead.count({
            where: {
              id: { in: leadIds },
              conversations: { some: { messages: { some: { direction: "INBOUND" } } } },
            },
          })
        : 0;
      variants.push({
        id: v.id,
        label: v.label,
        body: v.body,
        subject: v.subject,
        weight: v.weight,
        sent: msgs.length,
        recipients: leadIds.length,
        replied,
        replyRate: leadIds.length ? replied / leadIds.length : 0,
      });
    }
    out.push({ nodeId: node.id, order: node.order, actionType: node.actionType, variants });
  }
  return out;
}
