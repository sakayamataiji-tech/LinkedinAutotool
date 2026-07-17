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

export interface NodeInput {
  kind: NodeKind;
  actionType?: string | null;
  messageBody?: string | null;
  messageSubject?: string | null;
  delayMinutes?: number | null;
  conditionType?: string | null;
  posX?: number;
  posY?: number;
}

/** Create a node from the flow editor and return its id (for placement). */
export async function createNode(sequenceId: string, input: NodeInput): Promise<{ id: string } | null> {
  const teamId = await getCurrentTeamId();
  const seq = await prisma.sequence.findFirst({ where: { id: sequenceId, teamId } });
  if (!seq) return null;
  const count = await prisma.sequenceNode.count({ where: { sequenceId } });
  const node = await prisma.sequenceNode.create({
    data: {
      sequenceId,
      kind: input.kind,
      order: count,
      posX: input.posX ?? 0,
      posY: input.posY ?? count * 120,
      actionType: input.kind === "ACTION" ? (input.actionType as ActionType) ?? null : null,
      messageBody: input.kind === "ACTION" ? input.messageBody ?? null : null,
      messageSubject: input.kind === "ACTION" ? input.messageSubject ?? null : null,
      delayMinutes: input.kind === "DELAY" ? input.delayMinutes ?? 1440 : null,
      conditionType: input.kind === "CONDITION" ? (input.conditionType as ConditionType) ?? null : null,
    },
  });
  return { id: node.id };
}

/** Update an existing node's editable content. */
export async function updateSequenceNode(nodeId: string, input: Partial<NodeInput>): Promise<void> {
  const teamId = await getCurrentTeamId();
  const node = await prisma.sequenceNode.findFirst({
    where: { id: nodeId, sequence: { teamId } },
  });
  if (!node) return;
  await prisma.sequenceNode.update({
    where: { id: nodeId },
    data: {
      ...(input.messageBody !== undefined ? { messageBody: input.messageBody || null } : {}),
      ...(input.messageSubject !== undefined ? { messageSubject: input.messageSubject || null } : {}),
      ...(input.delayMinutes !== undefined ? { delayMinutes: input.delayMinutes } : {}),
      ...(input.actionType !== undefined ? { actionType: (input.actionType as ActionType) ?? null } : {}),
      ...(input.conditionType !== undefined
        ? { conditionType: (input.conditionType as ConditionType) ?? null }
        : {}),
    },
  });
}

export async function deleteSequenceNode(nodeId: string, sequenceId: string) {
  await prisma.sequenceNode.delete({ where: { id: nodeId } });
  revalidatePath(`/sequences/${sequenceId}`);
}

/** Persist node canvas positions (x/y) after a drag on the flow editor. */
export async function updateNodePositions(
  sequenceId: string,
  positions: { id: string; x: number; y: number }[],
) {
  const teamId = await getCurrentTeamId();
  const seq = await prisma.sequence.findFirst({ where: { id: sequenceId, teamId } });
  if (!seq) return;
  const owned = new Set(
    (await prisma.sequenceNode.findMany({ where: { sequenceId }, select: { id: true } })).map(
      (n) => n.id,
    ),
  );
  await prisma.$transaction(
    positions
      .filter((p) => owned.has(p.id))
      .map((p) =>
        prisma.sequenceNode.update({ where: { id: p.id }, data: { posX: p.x, posY: p.y } }),
      ),
  );
  // No revalidate: positions are cosmetic and the client already reflects them.
}

/** Persist a new node ordering from a drag-and-drop reorder. */
export async function reorderSequenceNodes(sequenceId: string, orderedIds: string[]) {
  const teamId = await getCurrentTeamId();
  const seq = await prisma.sequence.findFirst({ where: { id: sequenceId, teamId } });
  if (!seq) return;
  // Only reorder nodes that belong to this sequence.
  const owned = new Set(
    (await prisma.sequenceNode.findMany({ where: { sequenceId }, select: { id: true } })).map(
      (n) => n.id,
    ),
  );
  const ids = orderedIds.filter((id) => owned.has(id));
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.sequenceNode.update({ where: { id }, data: { order: i, posY: i * 90 } }),
    ),
  );
  revalidatePath(`/sequences/${sequenceId}`);
}

// --- Message templates -----------------------------------------------------

export async function createTemplate(formData: FormData) {
  const teamId = await getCurrentTeamId();
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "message");
  const subject = String(formData.get("subject") ?? "").trim() || null;
  if (!name || !body) return;
  await prisma.messageTemplate.create({ data: { teamId, name, body, category, subject } });
  revalidatePath("/templates");
}

export async function updateTemplate(id: string, formData: FormData) {
  const teamId = await getCurrentTeamId();
  const tpl = await prisma.messageTemplate.findFirst({ where: { id, teamId } });
  if (!tpl) return;
  await prisma.messageTemplate.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? tpl.name).trim() || tpl.name,
      body: String(formData.get("body") ?? tpl.body),
      subject: String(formData.get("subject") ?? "").trim() || null,
      category: String(formData.get("category") ?? tpl.category),
    },
  });
  revalidatePath("/templates");
}

export async function deleteTemplate(id: string) {
  const teamId = await getCurrentTeamId();
  const tpl = await prisma.messageTemplate.findFirst({ where: { id, teamId } });
  if (!tpl) return;
  await prisma.messageTemplate.delete({ where: { id } });
  revalidatePath("/templates");
}

// --- A/B variants ----------------------------------------------------------

const VARIANT_LABELS = ["A", "B", "C", "D", "E", "F"];

/** Turn a single-body message node into an A/B test (seeds variants A & B). */
export async function enableAbTest(nodeId: string) {
  const teamId = await getCurrentTeamId();
  const node = await prisma.sequenceNode.findFirst({
    where: { id: nodeId, sequence: { teamId } },
    include: { variants: true },
  });
  if (!node || node.variants.length > 0) return;
  const base = node.messageBody ?? "";
  await prisma.messageVariant.createMany({
    data: [
      { nodeId, label: "A", body: base, subject: node.messageSubject },
      { nodeId, label: "B", body: base, subject: node.messageSubject },
    ],
  });
  revalidatePath(`/sequences/${node.sequenceId}`);
}

export async function addVariant(nodeId: string) {
  const teamId = await getCurrentTeamId();
  const node = await prisma.sequenceNode.findFirst({
    where: { id: nodeId, sequence: { teamId } },
    include: { variants: true },
  });
  if (!node) return;
  const label = VARIANT_LABELS[node.variants.length] ?? `V${node.variants.length + 1}`;
  await prisma.messageVariant.create({
    data: { nodeId, label, body: node.messageBody ?? "" },
  });
  revalidatePath(`/sequences/${node.sequenceId}`);
}

export async function updateVariant(variantId: string, body: string, subject: string) {
  const teamId = await getCurrentTeamId();
  const variant = await prisma.messageVariant.findFirst({
    where: { id: variantId, node: { sequence: { teamId } } },
    include: { node: true },
  });
  if (!variant) return;
  await prisma.messageVariant.update({
    where: { id: variantId },
    data: { body, subject: subject.trim() || null },
  });
  revalidatePath(`/sequences/${variant.node.sequenceId}`);
}

export async function deleteVariant(variantId: string) {
  const teamId = await getCurrentTeamId();
  const variant = await prisma.messageVariant.findFirst({
    where: { id: variantId, node: { sequence: { teamId } } },
    include: { node: true },
  });
  if (!variant) return;
  await prisma.messageVariant.delete({ where: { id: variantId } });
  revalidatePath(`/sequences/${variant.node.sequenceId}`);
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

/**
 * Demo helper: inject an inbound reply from a lead, which triggers reply
 * detection + auto-pause. In production this path is driven by a LinkedIn/email
 * webhook or the scheduler's reply poller.
 */
export async function simulateReplyAction(leadId: string, channel = "linkedin") {
  const { recordInboundReply } = await import("./replies");
  await recordInboundReply(
    leadId,
    "ご連絡ありがとうございます。ぜひ一度お話しできればと思います。",
    channel,
  );
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath(`/leads/${leadId}`);
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
  const { generateWebhookSecret } = await import("./webhooks");
  const url = String(formData.get("url") ?? "").trim();
  // Subscribed events come from checkboxes (empty selection = all events).
  const events = formData.getAll("events").map(String).filter(Boolean);
  if (!url) return;
  await prisma.webhook.create({
    data: { teamId, url, events, secret: generateWebhookSecret() },
  });
  revalidatePath("/settings");
}

async function assertOwnWebhook(webhookId: string): Promise<boolean> {
  const teamId = await getCurrentTeamId();
  const wh = await prisma.webhook.findFirst({ where: { id: webhookId, teamId } });
  return Boolean(wh);
}

export async function deleteWebhook(webhookId: string) {
  if (!(await assertOwnWebhook(webhookId))) return;
  await prisma.webhook.delete({ where: { id: webhookId } });
  revalidatePath("/settings");
}

export async function toggleWebhook(webhookId: string, active: boolean) {
  if (!(await assertOwnWebhook(webhookId))) return;
  await prisma.webhook.update({ where: { id: webhookId }, data: { active } });
  revalidatePath("/settings");
}

export async function testWebhook(webhookId: string): Promise<boolean> {
  if (!(await assertOwnWebhook(webhookId))) return false;
  const { sendTestWebhook } = await import("./webhooks");
  const ok = await sendTestWebhook(webhookId);
  revalidatePath("/settings");
  return ok;
}
