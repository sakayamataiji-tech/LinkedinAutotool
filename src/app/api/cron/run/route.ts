import { runScheduler } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/**
 * Cron entry point. Configure a scheduler (Vercel Cron, GitHub Actions,
 * external cron, or the bundled poller) to hit this on an interval.
 *
 * Security: when CRON_SECRET is set, the request must present it via
 * `Authorization: Bearer <secret>` or `?secret=<secret>`. Vercel Cron sends
 * the Authorization header automatically. When unset (local dev), it's open.
 */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const url = new URL(req.url);
    const provided = auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
    if (provided !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const ignoreWorkingHours = url.searchParams.get("force") === "1";

  const started = Date.now();
  const result = await runScheduler({ ignoreWorkingHours });
  return Response.json({
    ok: true,
    durationMs: Date.now() - started,
    ...result,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
