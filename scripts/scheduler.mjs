#!/usr/bin/env node
/**
 * Standalone poller for the scheduler endpoint. Useful for local/self-hosted
 * runs where you don't want the in-process scheduler.
 *
 *   BASE_URL=http://localhost:3000 CRON_SECRET=xxx INTERVAL_SECONDS=300 \
 *     npm run scheduler
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const INTERVAL = Number(process.env.INTERVAL_SECONDS ?? 300) * 1000;

const endpoint = `${BASE_URL.replace(/\/$/, "")}/api/cron/run`;

async function tick() {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: CRON_SECRET ? { authorization: `Bearer ${CRON_SECRET}` } : {},
    });
    const body = await res.json().catch(() => ({}));
    console.log(new Date().toISOString(), res.status, JSON.stringify(body));
  } catch (err) {
    console.error(new Date().toISOString(), "error", err.message);
  }
}

console.log(`Polling ${endpoint} every ${INTERVAL / 1000}s`);
await tick();
setInterval(tick, INTERVAL);
