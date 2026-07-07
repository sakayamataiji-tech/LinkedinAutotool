"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentTeamId } from "./session";
import { runDueSteps } from "./engine";
import { cleanName } from "./text";
import type { ActionType, CampaignStatus, ConditionType, LeadSource, NodeKind } from "@prisma/client";

// --- Campaigns -------------------------------------------------------------

export async function createCampaign(formData: FormData) {
  const teamId = await getCurrentTeamId();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sequenceId = String(formData.get("sequenceId") ?? "") || null;
  if (!name) return;

  await prisma.campaign.create({
    data: { teamId, name, description, sequenceId },
  });
  revalidatePath("/campaigns");
}

export async function setCampaignStatus(campaignId: string, status: CampaignStatus) {
  await prisma.campaign.update({ where: { id: campaignId }, data: { status } });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
}

/** Run the sequence engine for a campaign — processes all due steps. */
export async function runCampaign(campaignId: string) {
  const teamId = await getCurrentTeamId();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;
  if (campaign.status === "DRAFT") {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "RUNNING" } });
  }
  const result = await runDueSteps({ teamId, campaignId });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/inbox");
  revalidatePath("/");
  return result;
}

export async function addLeadsToCampaign(campaignId: string, leadIds: string[]) {
  await prisma.$transaction(
    leadIds.map((leadId) =>
      prisma.campaignLead.upsert({
        where: { campaignId_leadId: { campaignId, leadId } },
        update: {},
        create: { campaignId, leadId },
      }),
    ),
  );
  revalidatePath(`/campaigns/${campaignId}`);
}

// --- Sequences -------------------------------------------------------------

export async function createSequence(formData: FormData) {
  const teamId = await getCurrentTeamId();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const isTemplate = formData.get("isTemplate") === "on";
  if (!name) return;
  await prisma.sequence.create({
    data: { teamId, name, description, isTemplate },
  });
  revalidatePath("/sequences");
}

export async function addSequenceNode(formData: FormData) {
  const sequenceId = String(formData.get("sequenceId") ?? "");
  const kind = String(formData.get("kind") ?? "ACTION") as NodeKind;
  if (!sequenceId) return;

  const count = await prisma.sequenceNode.count({ where: { sequenceId } });

  await prisma.sequenceNode.create({
    data: {
      sequenceId,
      kind,
      order: count,
      posY: count * 90,
      actionType: kind === "ACTION" ? (String(formData.get("actionType")) as ActionType) : null,
      messageBody:
        kind === "ACTION" ? String(formData.get("messageBody") ?? "") || null : null,
      messageSubject:
        kind === "ACTION" ? String(formData.get("messageSubject") ?? "") || null : null,
      delayMinutes: kind === "DELAY" ? Number(formData.get("delayMinutes") ?? 60) || 60 : null,
      conditionType:
        kind === "CONDITION" ? (String(formData.get("conditionType")) as ConditionType) : null,
    },
  });
  revalidatePath(`/sequences/${sequenceId}`);
}

export async function deleteSequenceNode(nodeId: string, sequenceId: string) {
  await prisma.sequenceNode.delete({ where: { id: nodeId } });
  revalidatePath(`/sequences/${sequenceId}`);
}

// --- Leads -----------------------------------------------------------------

export async function createLead(formData: FormData) {
  const teamId = await getCurrentTeamId();
  const rawName = String(formData.get("name") ?? "").trim();
  const clean = cleanName(rawName);
  const [firstName, ...rest] = clean.split(" ");
  const source = (String(formData.get("source") ?? "MANUAL") as LeadSource) || "MANUAL";

  if (!firstName) return;

  await prisma.lead.create({
    data: {
      teamId,
      firstName,
      lastName: rest.join(" ") || "",
      company: String(formData.get("company") ?? "").trim() || null,
      jobTitle: String(formData.get("jobTitle") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      profileUrl: String(formData.get("profileUrl") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      source,
    },
  });
  revalidatePath("/leads");
}

export async function setLeadBlacklist(leadId: string, blacklisted: boolean) {
  await prisma.lead.update({ where: { id: leadId }, data: { blacklisted } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function updateLeadNotes(leadId: string, notes: string) {
  await prisma.lead.update({ where: { id: leadId }, data: { notes } });
  revalidatePath(`/leads/${leadId}`);
}

// --- Inbox -----------------------------------------------------------------

export async function replyInInbox(conversationId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  await prisma.message.create({
    data: { conversationId, direction: "OUTBOUND", body: text },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), unread: false },
  });
  revalidatePath("/inbox");
}

export async function toggleConversationFlag(
  conversationId: string,
  flag: "important" | "archived" | "unread",
  value: boolean,
) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { [flag]: value },
  });
  revalidatePath("/inbox");
}

// --- Settings --------------------------------------------------------------

export async function updateDailyLimits(formData: FormData) {
  const teamId = await getCurrentTeamId();
  const num = (k: string, d: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : d;
  };
  const data = {
    maxConnectionRequests: num("maxConnectionRequests", 20),
    maxMessages: num("maxMessages", 50),
    maxInmails: num("maxInmails", 10),
    maxProfileViews: num("maxProfileViews", 100),
    maxEndorsements: num("maxEndorsements", 20),
    maxLikes: num("maxLikes", 30),
    maxFollows: num("maxFollows", 30),
    maxEmails: num("maxEmails", 50),
    timezone: String(formData.get("timezone") ?? "Asia/Tokyo"),
  };
  await prisma.dailyLimit.upsert({
    where: { teamId },
    update: data,
    create: { teamId, ...data },
  });
  revalidatePath("/settings");
}

export async function updateWorkingHours(formData: FormData) {
  const teamId = await getCurrentTeamId();
  const timezone = String(formData.get("timezone") ?? "Asia/Tokyo");
  // 7 days, index 0 = Monday .. 6 = Sunday.
  const workingHours = Array.from({ length: 7 }).map((_, i) => ({
    enabled: formData.get(`wh_${i}_enabled`) === "on",
    start: String(formData.get(`wh_${i}_start`) ?? "09:00"),
    end: String(formData.get(`wh_${i}_end`) ?? "18:00"),
  }));
  await prisma.dailyLimit.upsert({
    where: { teamId },
    update: { workingHours, timezone },
    create: { teamId, workingHours, timezone },
  });
  revalidatePath("/settings");
}

export async function runSchedulerNow() {
  const { runScheduler } = await import("./schedule");
  // Manual trigger ignores working hours by intent.
  const result = await runScheduler({ ignoreWorkingHours: true });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/inbox");
  return result;
}

export async function createWebhook(formData: FormData) {
  const teamId = await getCurrentTeamId();
  const url = String(formData.get("url") ?? "").trim();
  const events = String(formData.get("events") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!url) return;
  await prisma.webhook.create({ data: { teamId, url, events } });
  revalidatePath("/settings");
}
