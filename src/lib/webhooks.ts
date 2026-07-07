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

/** Deliver one event to one webhook with retries; records the outcome. */
async function deliverToWebhook(
  webhook: WebhookRow,
  event: WebhookEvent,
  payload: unknown,
): Promise<boolean> {
  const deliveryId = randomHex(12);
  const body = JSON.stringify({
    id: deliveryId,
    event,
    // Timestamp is set by the DB row; receivers can also read the header.
    data: payload,
  });
  const secret = webhook.secret ?? "";
  const headers: Record<string, string> = {
    "X-LA-Event": event,
    "X-LA-Delivery": deliveryId,
    "User-Agent": "LinkedInAutotool-Webhook/1.0",
  };
  if (secret) headers["X-LA-Signature"] = `sha256=${await hmacSha256(secret, body)}`;

  let last = { statusCode: null as number | null, ok: false, error: "not attempted" as string | null };
  let attempts = 0;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts = i + 1;
    last = await deliverOnce(webhook.url, body, headers);
    if (last.ok) break;
    if (i < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }

  await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event,
      url: webhook.url,
      statusCode: last.statusCode ?? undefined,
      success: last.ok,
      attempts,
      error: last.error ?? undefined,
    },
  });

  return last.ok;
}

/**
 * Dispatch an event to every active webhook of a team subscribed to it
 * (empty subscription list = all events). Runs deliveries in parallel and
 * swallows all errors.
 */
export async function dispatchWebhookEvent(
  teamId: string,
  event: WebhookEvent,
  payload: unknown,
): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { teamId, active: true },
      select: { id: true, url: true, secret: true, events: true },
    });
    const targets = webhooks.filter(
      (w) => w.events.length === 0 || w.events.includes(event),
    );
    if (targets.length === 0) return;
    await Promise.all(targets.map((w) => deliverToWebhook(w, event, payload)));
  } catch (err) {
    console.error("[webhook] dispatch error", err);
  }
}

/** Send a test `ping` to a single webhook (ignores subscription filter). */
export async function sendTestWebhook(webhookId: string): Promise<boolean> {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    select: { id: true, url: true, secret: true },
  });
  if (!webhook) return false;
  return deliverToWebhook(webhook, "ping", { message: "テスト配信", at: new Date().toISOString() });
}
