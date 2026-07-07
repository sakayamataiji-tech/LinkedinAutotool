import type { ActionType, Prisma, SequenceNode } from "@prisma/client";
import { prisma } from "./prisma";
import { getProvider, type LeadContext } from "./linkedin";
import { renderTemplate } from "./text";

/**
 * Sequence execution engine.
 *
 * Walks each campaign lead through the visual sequence graph one node at a
 * time. Actions run through the pluggable LinkedIn provider; delays schedule
 * the next run; conditions branch. Daily limits gate how many of each action
 * type may run per team per day.
 */

// Map an action type to the daily-limit field that governs it.
const LIMIT_FIELD: Partial<Record<ActionType, keyof DailyLimitCaps>> = {
  CONNECT_REQUEST: "maxConnectionRequests",
  MESSAGE: "maxMessages",
  INMAIL: "maxInmails",
  VIEW_PROFILE: "maxProfileViews",
  ENDORSE_SKILL: "maxEndorsements",
  LIKE_POST: "maxLikes",
  FOLLOW: "maxFollows",
  SEND_EMAIL: "maxEmails",
};

interface DailyLimitCaps {
  maxConnectionRequests: number;
  maxMessages: number;
  maxInmails: number;
  maxProfileViews: number;
  maxEndorsements: number;
  maxLikes: number;
  maxFollows: number;
  maxEmails: number;
}

const DEFAULT_CAPS: DailyLimitCaps = {
  maxConnectionRequests: 20,
  maxMessages: 50,
  maxInmails: 10,
  maxProfileViews: 100,
  maxEndorsements: 20,
  maxLikes: 30,
  maxFollows: 30,
  maxEmails: 50,
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function actionCountToday(teamId: string, actionType: ActionType): Promise<number> {
  return prisma.activityLog.count({
    where: {
      teamId,
      actionType,
      status: "success",
      createdAt: { gte: startOfToday() },
    },
  });
}

async function getCaps(teamId: string): Promise<DailyLimitCaps> {
  const limit = await prisma.dailyLimit.findUnique({ where: { teamId } });
  if (!limit) return DEFAULT_CAPS;
  return {
    maxConnectionRequests: limit.maxConnectionRequests,
    maxMessages: limit.maxMessages,
    maxInmails: limit.maxInmails,
    maxProfileViews: limit.maxProfileViews,
    maxEndorsements: limit.maxEndorsements,
    maxLikes: limit.maxLikes,
    maxFollows: limit.maxFollows,
    maxEmails: limit.maxEmails,
  };
}

/** Check whether an action of this type is still under today's cap. */
async function withinDailyLimit(teamId: string, actionType: ActionType): Promise<boolean> {
  const field = LIMIT_FIELD[actionType];
  if (!field) return true; // ungoverned actions (FIND_EMAIL, WITHDRAW_REQUEST)
  const caps = await getCaps(teamId);
  const used = await actionCountToday(teamId, actionType);
  return used < caps[field];
}

function toLeadContext(lead: {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  profileUrl: string | null;
  email: string | null;
  isConnected: boolean;
  isOpenProfile: boolean;
}): LeadContext {
  return {
    leadId: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    jobTitle: lead.jobTitle,
    profileUrl: lead.profileUrl,
    email: lead.email,
    isConnected: lead.isConnected,
    isOpenProfile: lead.isOpenProfile,
  };
}

function nextByOrder(nodes: SequenceNode[], current: SequenceNode): SequenceNode | null {
  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((n) => n.id === current.id);
  return sorted[idx + 1] ?? null;
}

function nodeById(nodes: SequenceNode[], id: string | null): SequenceNode | null {
  if (!id) return null;
  return nodes.find((n) => n.id === id) ?? null;
}

export interface StepOutcome {
  campaignLeadId: string;
  processed: boolean;
  reason?: string;
}

/**
 * Advance a single campaign lead by executing its current node. Returns whether
 * a node was processed (false = blocked by daily limit / waiting / finished).
 */
export async function stepCampaignLead(campaignLeadId: string): Promise<StepOutcome> {
  const cl = await prisma.campaignLead.findUnique({
    where: { id: campaignLeadId },
    include: {
      lead: true,
      campaign: { include: { sequence: { include: { nodes: true } } } },
    },
  });

  if (!cl) return { campaignLeadId, processed: false, reason: "not_found" };
  if (cl.status !== "IN_PROGRESS" && cl.status !== "PENDING")
    return { campaignLeadId, processed: false, reason: `status_${cl.status}` };
  if (cl.lead.blacklisted) {
    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: { status: "BLACKLISTED" },
    });
    return { campaignLeadId, processed: false, reason: "blacklisted" };
  }

  const nodes = cl.campaign.sequence?.nodes ?? [];
  if (nodes.length === 0) {
    await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: "COMPLETED" } });
    return { campaignLeadId, processed: false, reason: "empty_sequence" };
  }

  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  let current = cl.currentNodeId ? nodeById(nodes, cl.currentNodeId) : sorted[0];
  if (!current) {
    await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: "COMPLETED" } });
    return { campaignLeadId, processed: false, reason: "completed" };
  }

  // Respect scheduled delay.
  if (cl.nextRunAt && cl.nextRunAt.getTime() > Date.now()) {
    return { campaignLeadId, processed: false, reason: "waiting" };
  }

  const teamId = cl.lead.teamId;
  const provider = getProvider();

  if (current.kind === "DELAY") {
    const minutes = current.delayMinutes ?? 0;
    const next = nextByOrder(nodes, current);
    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: {
        status: next ? "IN_PROGRESS" : "COMPLETED",
        currentNodeId: next?.id ?? null,
        nextRunAt: next ? new Date(Date.now() + minutes * 60_000) : null,
      },
    });
    return { campaignLeadId, processed: true, reason: `delay_${minutes}m` };
  }

  if (current.kind === "CONDITION") {
    const result = await provider.evaluate({
      conditionType: current.conditionType!,
      lead: toLeadContext(cl.lead),
    });
    const branchTarget = result
      ? nodeById(nodes, current.trueNextId)
      : nodeById(nodes, current.falseNextId);
    const next = branchTarget ?? nextByOrder(nodes, current);
    await prisma.activityLog.create({
      data: {
        teamId,
        campaignId: cl.campaignId,
        campaignLeadId: cl.id,
        leadId: cl.leadId,
        status: "success",
        detail: `条件[${current.conditionType}] = ${result ? "true" : "false"}`,
      },
    });
    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: {
        status: next ? "IN_PROGRESS" : "COMPLETED",
        currentNodeId: next?.id ?? null,
        nextRunAt: null,
      },
    });
    return { campaignLeadId, processed: true, reason: `condition_${result}` };
  }

  // ACTION node
  const actionType = current.actionType!;
  if (!(await withinDailyLimit(teamId, actionType))) {
    // Leave pointer where it is; retry later.
    return { campaignLeadId, processed: false, reason: "daily_limit" };
  }

  const body = current.messageBody
    ? renderTemplate(current.messageBody, {
        firstName: cl.lead.firstName,
        lastName: cl.lead.lastName,
        company: cl.lead.company,
        jobTitle: cl.lead.jobTitle,
      })
    : undefined;

  const result = await provider.execute({
    actionType,
    lead: toLeadContext(cl.lead),
    body,
    subject: current.messageSubject ?? undefined,
  });

  // Persist lead-side effects.
  if (result.patch) {
    await prisma.lead.update({
      where: { id: cl.leadId },
      data: {
        ...(result.patch.isConnected !== undefined ? { isConnected: result.patch.isConnected } : {}),
        ...(result.patch.email ? { email: result.patch.email } : {}),
        ...(result.patch.emailStatus ? { emailStatus: result.patch.emailStatus } : {}),
        ...(result.patch.isOpenProfile !== undefined
          ? { isOpenProfile: result.patch.isOpenProfile }
          : {}),
      },
    });
  }

  // Record an outbound message + conversation for messaging actions.
  if (result.message && result.ok) {
    const convo = await prisma.conversation.upsert({
      where: { id: `${cl.leadId}-${result.message.channel}` },
      update: { lastMessageAt: new Date() },
      create: {
        id: `${cl.leadId}-${result.message.channel}`,
        leadId: cl.leadId,
        channel: result.message.channel,
        lastMessageAt: new Date(),
      },
    });
    await prisma.message.create({
      data: {
        conversationId: convo.id,
        direction: "OUTBOUND",
        body: result.message.body,
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      teamId,
      campaignId: cl.campaignId,
      campaignLeadId: cl.id,
      leadId: cl.leadId,
      actionType,
      status: result.ok ? "success" : "failed",
      detail: result.detail,
    },
  });

  const connectionAccepted =
    actionType === "CONNECT_REQUEST" && result.patch?.isConnected === true;

  const next = nextByOrder(nodes, current);
  await prisma.campaignLead.update({
    where: { id: cl.id },
    data: {
      status: result.ok ? (next ? "IN_PROGRESS" : "COMPLETED") : "FAILED",
      currentNodeId: next?.id ?? null,
      nextRunAt: null,
      ...(connectionAccepted ? { connectionAccepted: true } : {}),
    },
  });

  return { campaignLeadId, processed: true, reason: result.detail };
}

/**
 * Process all campaign leads that are due to run for a campaign (or all running
 * campaigns for a team). Loops each lead forward until it hits a delay,
 * condition wait, limit, or completion — bounded to avoid infinite loops.
 */
export async function runDueSteps(opts: {
  teamId: string;
  campaignId?: string;
  maxPerLead?: number;
}): Promise<{ processed: number; outcomes: StepOutcome[] }> {
  const { teamId, campaignId, maxPerLead = 20 } = opts;

  const campaignFilter: Prisma.CampaignLeadWhereInput = campaignId
    ? { campaignId }
    : { campaign: { teamId, status: "RUNNING" } };

  const due = await prisma.campaignLead.findMany({
    where: {
      ...campaignFilter,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
    },
    select: { id: true },
    take: 500,
  });

  const outcomes: StepOutcome[] = [];
  let processed = 0;

  for (const { id } of due) {
    for (let i = 0; i < maxPerLead; i++) {
      const outcome = await stepCampaignLead(id);
      if (!outcome.processed) {
        outcomes.push(outcome);
        break;
      }
      processed++;
      // Stop looping this lead once it is parked on a future delay.
      const refreshed = await prisma.campaignLead.findUnique({
        where: { id },
        select: { status: true, nextRunAt: true },
      });
      if (
        !refreshed ||
        refreshed.status !== "IN_PROGRESS" ||
        (refreshed.nextRunAt && refreshed.nextRunAt.getTime() > Date.now())
      ) {
        break;
      }
    }
  }

  return { processed, outcomes };
}
