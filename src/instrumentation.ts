/**
 * Optional in-process scheduler.
 *
 * Enabled with ENABLE_INPROCESS_SCHEDULER=true (best for a long-running
 * `next start` / self-hosted deploy). On serverless (Vercel) use the cron
 * endpoint instead — see vercel.json. Runs only in the Node.js runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_INPROCESS_SCHEDULER !== "true") return;

  const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000);
  const { runScheduler } = await import("./lib/schedule");

  let running = false;
  const tick = async () => {
    if (running) return; // avoid overlap on slow runs
    running = true;
    try {
      const res = await runScheduler();
      if (res.processed > 0) {
        console.log(
          `[scheduler] processed=${res.processed} teamsRun=${res.teamsRun}/${res.teamsConsidered}`,
        );
      }
    } catch (err) {
      console.error("[scheduler] error", err);
    } finally {
      running = false;
    }
  };

  console.log(`[scheduler] in-process scheduler enabled (every ${intervalMs}ms)`);
  setInterval(tick, intervalMs);
}
