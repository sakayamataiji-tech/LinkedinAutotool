import { prisma } from "./prisma";
import { sequenceVariantStats } from "./ab";

/**
 * Team-wide analytics. Period-bound series/breakdowns plus lifetime funnel and
 * per-campaign / per-variant comparisons.
 */

export interface DailyPoint {
  date: string;
  connectionsSent: number;
  messagesSent: number;
  replies: number;
  profileViews: number;
}

export interface Breakdown {
  key: string;
  label: string;
  count: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  leads: number;
  connectionsSent: number;
  acceptanceRate: number;
  messagesSent: number;
  replyRate: number;
}

export interface VariantRow {
  sequence: string;
  node: number;
  label: string;
  sent: number;
  replied: number;
  replyRate: number;
}

export interface TeamAnalytics {
  days: number;
  summary: {
    connectionsSent: number;
    connectionsAccepted: number;
    acceptanceRate: number;
    messagesSent: number;
    replies: number;
    replyRate: number;
    profileViews: number;
    emailsSent: number;
  };
  daily: DailyPoint[];
  funnel: FunnelStage[];
  channels: Breakdown[];
  actions: Breakdown[];
  campaigns: CampaignRow[];
  variants: VariantRow[];
}

const ACTION_LABEL: Record<string, string> = {
  CONNECT_REQUEST: "接続リクエスト",
  MESSAGE: "メッセージ",
  INMAIL: "InMail",
  VIEW_PROFILE: "プロフィール閲覧",
  ENDORSE_SKILL: "スキル推薦",
  FOLLOW: "フォロー",
  LIKE_POST: "いいね",
  FIND_EMAIL: "メール検索",
  SEND_EMAIL: "メール送信",
  WITHDRAW_REQUEST: "リクエスト取消",
};

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  inmail: "InMail",
  email: "メール",
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function teamAnalytics(teamId: string, days: number): Promise<TeamAnalytics> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [logs, outboundMsgs, inboundMsgs, campaigns, sequences] = await Promise.all([
    prisma.activityLog.findMany({
      where: { teamId, status: "success", createdAt: { gte: since } },
      select: { actionType: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: {
        direction: "OUTBOUND",
        sentAt: { gte: since },
        conversation: { lead: { teamId } },
      },
      select: { sentAt: true, conversation: { select: { channel: true } } },
    }),
    prisma.message.findMany({
      where: {
        direction: "INBOUND",
        sentAt: { gte: since },
        conversation: { lead: { teamId } },
      },
      select: { sentAt: true },
    }),
    prisma.campaign.findMany({
      where: { teamId },
      include: { _count: { select: { leads: true } }, sequence: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sequence.findMany({ where: { teamId }, select: { id: true, name: true } }),
  ]);

  // Daily buckets.
  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(dayKey(d), {
      date: dayKey(d),
      connectionsSent: 0,
      messagesSent: 0,
      replies: 0,
      profileViews: 0,
    });
  }
  for (const l of logs) {
    const b = buckets.get(dayKey(l.createdAt));
    if (!b) continue;
    if (l.actionType === "CONNECT_REQUEST") b.connectionsSent++;
    else if (l.actionType === "MESSAGE" || l.actionType === "INMAIL") b.messagesSent++;
    else if (l.actionType === "VIEW_PROFILE") b.profileViews++;
  }
  for (const m of inboundMsgs) {
    const b = buckets.get(dayKey(m.sentAt));
    if (b) b.replies++;
  }
  const daily = Array.from(buckets.values());

  // Action breakdown (period).
  const actionCounts = new Map<string, number>();
  for (const l of logs) {
    if (!l.actionType) continue;
    actionCounts.set(l.actionType, (actionCounts.get(l.actionType) ?? 0) + 1);
  }
  const actions: Breakdown[] = Array.from(actionCounts.entries())
    .map(([key, count]) => ({ key, label: ACTION_LABEL[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);

  // Channel breakdown (period, outbound).
  const channelCounts = new Map<string, number>();
  for (const m of outboundMsgs) {
    const ch = m.conversation.channel;
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }
  const channels: Breakdown[] = Array.from(channelCounts.entries())
    .map(([key, count]) => ({ key, label: CHANNEL_LABEL[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);

  // Summary (period).
  const connectionsSent = actionCounts.get("CONNECT_REQUEST") ?? 0;
  const messagesSent = (actionCounts.get("MESSAGE") ?? 0) + (actionCounts.get("INMAIL") ?? 0);
  const replies = inboundMsgs.length;
  const profileViews = actionCounts.get("VIEW_PROFILE") ?? 0;
  const emailsSent = actionCounts.get("SEND_EMAIL") ?? 0;

  // Lifetime funnel + acceptance.
  const [enrolled, connectedLeads, messagedLeads, repliedLeads, acceptedTotal] = await Promise.all([
    prisma.lead.count({ where: { teamId, campaignLeads: { some: {} } } }),
    prisma.lead.count({ where: { teamId, campaignLeads: { some: { connectionAccepted: true } } } }),
    prisma.lead.count({
      where: { teamId, conversations: { some: { messages: { some: { direction: "OUTBOUND" } } } } },
    }),
    prisma.lead.count({
      where: { teamId, conversations: { some: { messages: { some: { direction: "INBOUND" } } } } },
    }),
    prisma.campaignLead.count({ where: { campaign: { teamId }, connectionAccepted: true } }),
  ]);

  const funnel: FunnelStage[] = [
    { key: "enrolled", label: "対象リード", count: enrolled },
    { key: "connected", label: "接続成立", count: connectedLeads },
    { key: "messaged", label: "メッセージ送信", count: messagedLeads },
    { key: "replied", label: "返信あり", count: repliedLeads },
  ];

  // Per-campaign comparison (lifetime).
  const campaignRows: CampaignRow[] = [];
  for (const c of campaigns) {
    const [cSent, cAccepted, cMsg, cReplied] = await Promise.all([
      prisma.activityLog.count({ where: { campaignId: c.id, actionType: "CONNECT_REQUEST", status: "success" } }),
      prisma.campaignLead.count({ where: { campaignId: c.id, connectionAccepted: true } }),
      prisma.activityLog.count({ where: { campaignId: c.id, actionType: { in: ["MESSAGE", "INMAIL"] }, status: "success" } }),
      prisma.campaignLead.count({ where: { campaignId: c.id, replied: true } }),
    ]);
    campaignRows.push({
      id: c.id,
      name: c.name,
      status: c.status,
      leads: c._count.leads,
      connectionsSent: cSent,
      acceptanceRate: cSent > 0 ? cAccepted / cSent : 0,
      messagesSent: cMsg,
      replyRate: cMsg > 0 ? cReplied / cMsg : 0,
    });
  }

  // Variant comparison across all sequences (lifetime).
  const variants: VariantRow[] = [];
  for (const seq of sequences) {
    const stats = await sequenceVariantStats(seq.id);
    for (const node of stats) {
      for (const v of node.variants) {
        variants.push({
          sequence: seq.name,
          node: node.order + 1,
          label: v.label,
          sent: v.sent,
          replied: v.replied,
          replyRate: v.replyRate,
        });
      }
    }
  }

  return {
    days,
    summary: {
      connectionsSent,
      connectionsAccepted: acceptedTotal,
      acceptanceRate: connectionsSent > 0 ? acceptedTotal / connectionsSent : 0,
      messagesSent,
      replies,
      replyRate: messagesSent > 0 ? replies / messagesSent : 0,
      profileViews,
      emailsSent,
    },
    daily,
    funnel,
    channels,
    actions,
    campaigns: campaignRows,
    variants,
  };
}
