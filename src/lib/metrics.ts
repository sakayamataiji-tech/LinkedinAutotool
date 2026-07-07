import { prisma } from "./prisma";
import type { CampaignLeadStatus } from "@prisma/client";

export interface CampaignMetrics {
  total: number;
  byStatus: Record<CampaignLeadStatus, number>;
  connectionsSent: number;
  connectionsAccepted: number;
  acceptanceRate: number; // 接続承認率
  messagesSent: number;
  repliesReceived: number;
  replyRate: number; // 返信率
}

const EMPTY_STATUS: Record<CampaignLeadStatus, number> = {
  PENDING: 0,
  IN_PROGRESS: 0,
  COMPLETED: 0,
  PAUSED: 0,
  FAILED: 0,
  BLACKLISTED: 0,
};

export async function computeCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const [statusGroups, connSent, connAccepted, msgSent, replies, total] = await Promise.all([
    prisma.campaignLead.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
    }),
    prisma.activityLog.count({
      where: { campaignId, actionType: "CONNECT_REQUEST", status: "success" },
    }),
    prisma.campaignLead.count({ where: { campaignId, connectionAccepted: true } }),
    prisma.activityLog.count({
      where: { campaignId, actionType: { in: ["MESSAGE", "INMAIL"] }, status: "success" },
    }),
    prisma.campaignLead.count({ where: { campaignId, replied: true } }),
    prisma.campaignLead.count({ where: { campaignId } }),
  ]);

  const byStatus = { ...EMPTY_STATUS };
  for (const g of statusGroups) byStatus[g.status] = g._count;

  return {
    total,
    byStatus,
    connectionsSent: connSent,
    connectionsAccepted: connAccepted,
    acceptanceRate: connSent > 0 ? connAccepted / connSent : 0,
    messagesSent: msgSent,
    repliesReceived: replies,
    replyRate: msgSent > 0 ? replies / msgSent : 0,
  };
}

export interface DailyPoint {
  date: string;
  connectionsSent: number;
  connectionsAccepted: number;
  messagesSent: number;
  repliesReceived: number;
}

/** Build a daily activity series for the last N days (日次推移のグラフ). */
export async function dailySeries(campaignId: string, days = 14): Promise<DailyPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.activityLog.findMany({
    where: { campaignId, createdAt: { gte: since }, status: "success" },
    select: { actionType: true, createdAt: true },
  });

  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      connectionsSent: 0,
      connectionsAccepted: 0,
      messagesSent: 0,
      repliesReceived: 0,
    });
  }

  for (const log of logs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    if (log.actionType === "CONNECT_REQUEST") b.connectionsSent++;
    if (log.actionType === "MESSAGE" || log.actionType === "INMAIL") b.messagesSent++;
  }

  return Array.from(buckets.values());
}
