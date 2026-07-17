import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { WEBHOOK_EVENTS, type WebhookEvent } from "./webhook-events";

export { WEBHOOK_EVENTS };
export type { WebhookEvent };

// Uses the Web Crypto API (available in both Node and edge runtimes) so this
// module stays runtime-agnostic — it is reachable from instrumentation.ts,
// which Next compiles for edge as well.

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return toHex(sig);
}

/**
 * Webhook delivery.
 *
 * Fires registered webhooks on outreach events. Payloads are signed with
 * HMAC-SHA256 (per-webhook secret) so receivers can verify authenticity.
 * Delivery is best-effort with a short timeout and a couple of retries; every
 * attempt is recorded in WebhookDelivery. Delivery never throws — a failing
 * webhook must not break the sequence engine.
 */

const TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;

export function generateWebhookSecret(): string {
  return "whsec_" + randomHex(24);
}

async function deliverOnce(url: string, body: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
      signal: controller.signal,
    });
    return { statusCode: res.status, ok: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return {
      statusCode: null as number | null,
      ok: false,
      error: err instanceof Error ? err.message : "request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

interface WebhookRow {
  id: string;
  url: string;
  secret: string | null;
}

/** One delivery attempt to one webhook; records a WebhookDelivery row. */
async function deliverAttempt(
  webhook: WebhookRow,
  event: string,
  payload: unknown,
  attemptNo: number,
): Promise<{ ok: boolean; statusCode: number | null; error: string | null }> {
  const deliveryId = randomHex(12);
  const body = JSON.stringify({ id: deliveryId, event, data: payload });
  const secret = webhook.secret ?? "";
  const headers: Record<string, string> = {
    "X-LA-Event": event,
    "X-LA-Delivery": deliveryId,
    "User-Agent": "LinkedInAutotool-Webhook/1.0",
  };
  if (secret) headers["X-LA-Signature"] = `sha256=${await hmacSha256(secret, body)}`;

  const res = await deliverOnce(webhook.url, body, headers);
  await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event,
      url: webhook.url,
      statusCode: res.statusCode ?? undefined,
      success: res.ok,
      attempts: attemptNo,
      error: res.error ?? undefined,
    },
  });
  return res;
}

/**
 * Enqueue an event for every active webhook of a team subscribed to it (empty
 * subscription list = all events). This is FAST — it only writes outbox rows,
 * so the sequence engine never blocks on HTTP. Delivery happens asynchronously
 * in `drainWebhookJobs` (run by the scheduler). Never throws.
 */
export async function dispatchWebhookEvent(
  teamId: string,
  event: WebhookEvent,
  payload: unknown,
): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { teamId, active: true },
      select: { id: true, events: true },
    });
    const targets = webhooks.filter((w) => w.events.length === 0 || w.events.includes(event));
    if (targets.length === 0) return;
    await prisma.webhookJob.createMany({
      data: targets.map((w) => ({
        webhookId: w.id,
        event,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
      })),
    });
  } catch (err) {
    console.error("[webhook] enqueue error", err);
  }
}

function backoffMinutes(attempts: number): number {
  // 1, 2, 4, 8 … capped at 30 minutes.
  return Math.min(2 ** (attempts - 1), 30);
}

interface ClaimedJob {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  attempts: number;
}

/**
 * Deliver queued webhook jobs. Claims due pending jobs with FOR UPDATE SKIP
 * LOCKED (safe across concurrent drainers), attempts delivery, and reschedules
 * failures with exponential backoff until MAX_ATTEMPTS, then marks them failed.
 */
export async function drainWebhookJobs(limit = 100): Promise<{
  delivered: number;
  retried: number;
  failed: number;
}> {
  let claimed: ClaimedJob[] = [];
  try {
    claimed = await prisma.$queryRaw<ClaimedJob[]>(Prisma.sql`
      UPDATE "WebhookJob" AS t
      SET "lockedAt" = now()
      WHERE t.id IN (
        SELECT id FROM "WebhookJob"
        WHERE status = 'pending'
          AND "nextAttemptAt" <= now()
          AND ("lockedAt" IS NULL OR "lockedAt" < now() - interval '2 minutes')
        ORDER BY "nextAttemptAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING t.id, t."webhookId", t.event, t.payload, t.attempts;
    `);
  } catch (err) {
    console.error("[webhook] claim error", err);
    return { delivered: 0, retried: 0, failed: 0 };
  }

  let delivered = 0;
  let retried = 0;
  let failed = 0;

  await Promise.all(
    claimed.map(async (job) => {
      const webhook = await prisma.webhook.findUnique({
        where: { id: job.webhookId },
        select: { id: true, url: true, secret: true, active: true },
      });
      // Webhook removed/disabled: drop the job.
      if (!webhook || !webhook.active) {
        await prisma.webhookJob.update({
          where: { id: job.id },
          data: { status: "failed", lockedAt: null, lastError: "webhook missing/inactive" },
        });
        failed++;
        return;
      }

      const attemptNo = job.attempts + 1;
      const res = await deliverAttempt(webhook, job.event, job.payload, attemptNo);

      if (res.ok) {
        await prisma.webhookJob.update({
          where: { id: job.id },
          data: { status: "delivered", attempts: attemptNo, lockedAt: null, lastError: null },
        });
        delivered++;
      } else if (attemptNo >= MAX_ATTEMPTS) {
        await prisma.webhookJob.update({
          where: { id: job.id },
          data: { status: "failed", attempts: attemptNo, lockedAt: null, lastError: res.error },
        });
        failed++;
      } else {
        await prisma.webhookJob.update({
          where: { id: job.id },
          data: {
            attempts: attemptNo,
            lockedAt: null,
            lastError: res.error,
            nextAttemptAt: new Date(Date.now() + backoffMinutes(attemptNo) * 60_000),
          },
        });
        retried++;
      }
    }),
  );

  return { delivered, retried, failed };
}

/** Send a test `ping` to a single webhook immediately (manual, synchronous). */
export async function sendTestWebhook(webhookId: string): Promise<boolean> {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    select: { id: true, url: true, secret: true },
  });
  if (!webhook) return false;
  const res = await deliverAttempt(
    webhook,
    "ping",
    { message: "テスト配信", at: new Date().toISOString() },
    1,
  );
  return res.ok;
}
