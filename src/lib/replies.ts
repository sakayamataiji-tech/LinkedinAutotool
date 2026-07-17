import { prisma } from "./prisma";
import { getProvider, type LeadContext } from "./linkedin";
import { dispatchWebhookEvent } from "./webhooks";

/**
 * Reply detection + auto-pause.
 *
 * When a lead replies, the automated sequence must stop for that lead so a
 * human can take over instead of the tool sending more canned messages. This
 * module records inbound replies, marks the lead as replied, and pauses their
 * active campaign progression.
 */

/** Pause a lead's active sequences and mark them as replied. */
export async function handleReplyDetected(leadId: string): Promise<number> {
  // Mark every campaign membership of this lead as replied (for reply-rate).
  await prisma.campaignLead.updateMany({
    where: { leadId },
    data: { replied: true },
  });

  // Pause only the ones still in flight.
  const active = await prisma.campaignLead.findMany({
    where: { leadId, status: { in: ["IN_PROGRESS", "PENDING"] } },
    select: { id: true, campaignId: true },
  });

  for (const cl of active) {
    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: { status: "PAUSED", nextRunAt: null },
    });
    await prisma.activityLog.create({
      data: {
        campaignId: cl.campaignId,
        campaignLeadId: cl.id,
        leadId,
        status: "success",
        detail: "返信を検知したため、このリードのシーケンスを自動停止しました",
      },
    });
  }

  return active.length;
}

/**
 * Record an inbound reply from a lead (the entry point a real webhook/poller
 * would call), then trigger auto-pause.
 */
export async function recordInboundReply(
  leadId: string,
  body: string,
  channel = "linkedin",
): Promise<{ paused: number }> {
  const convoId = `${leadId}-${channel}`;
  await prisma.conversation.upsert({
    where: { id: convoId },
    update: { unread: true, lastMessageAt: new Date() },
    create: { id: convoId, leadId, channel, unread: true, lastMessageAt: new Date() },
  });
  await prisma.message.create({
    data: { conversationId: convoId, direction: "INBOUND", body },
  });

  const paused = await handleReplyDetected(leadId);

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { teamId: true, firstName: true, lastName: true, company: true, email: true },
  });
  if (lead) {
    await dispatchWebhookEvent(lead.teamId, "message.replied", {
      leadId,
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      company: lead.company,
      email: lead.email,
      body,
      pausedCampaigns: paused,
    });
  }

  return { paused };
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

/**
 * Poll for new replies across a team: consider leads that were messaged and
 * have an active campaign membership but no inbound message yet, and ask the
 * provider whether they replied.
 */
export async function pollRepliesForTeam(teamId: string): Promise<{ detected: number }> {
  const candidates = await prisma.lead.findMany({
    where: {
      teamId,
      blacklisted: false,
      campaignLeads: { some: { status: { in: ["IN_PROGRESS", "PENDING"] } } },
      conversations: {
        some: { messages: { some: { direction: "OUTBOUND" } } },
      },
    },
    include: { conversations: { include: { messages: true } } },
  });

  const provider = getProvider();
  let detected = 0;

  for (const lead of candidates) {
    const hasInbound = lead.conversations.some((c) =>
      c.messages.some((m) => m.direction === "INBOUND"),
    );
    if (hasInbound) continue; // already replied — don't re-detect

    const check = await provider.checkReply(toLeadContext(lead));
    if (check.replied && check.body) {
      await recordInboundReply(lead.id, check.body, check.channel ?? "linkedin");
      detected++;
    }
  }

  return { detected };
}
