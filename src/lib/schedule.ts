import { prisma } from "./prisma";
import { runDueSteps } from "./engine";
import { pollRepliesForTeam } from "./replies";

/**
 * Automatic scheduler.
 *
 * Drives every team's RUNNING campaigns forward, respecting each team's
 * timezone and per-weekday working hours. Invoked by the cron endpoint
 * (`/api/cron/run`), the in-process interval (instrumentation.ts) and the
 * "run now" button.
 */

export interface WorkingHourDay {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

// Order matches the seed: index 0 = Monday … 6 = Sunday.
const WEEKDAY_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Current weekday index (Mon=0) and minutes-since-midnight in a timezone. */
export function localNow(timezone: string, now: Date = new Date()): {
  weekday: number;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Monday";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { weekday: WEEKDAY_INDEX[weekdayName] ?? 0, minutes: hour * 60 + minute };
}

/**
 * Whether "now" falls inside the configured working window. When no config is
 * present, automation is always allowed.
 */
export function isWithinWorkingHours(
  workingHours: unknown,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (!Array.isArray(workingHours) || workingHours.length < 7) return true;
  const { weekday, minutes } = localNow(timezone, now);
  const day = workingHours[weekday] as WorkingHourDay | undefined;
  if (!day || !day.enabled) return false;
  return minutes >= toMinutes(day.start) && minutes < toMinutes(day.end);
}

export interface SchedulerResult {
  teamsConsidered: number;
  teamsRun: number;
  processed: number;
  repliesDetected: number;
  skipped: { teamId: string; teamName: string; reason: string }[];
}

/**
 * Process due sequence steps for every team that has a RUNNING campaign and is
 * currently inside its working hours.
 */
export async function runScheduler(opts: { ignoreWorkingHours?: boolean } = {}): Promise<SchedulerResult> {
  const teams = await prisma.team.findMany({
    where: { campaigns: { some: { status: "RUNNING" } } },
    include: { limits: true },
  });

  const result: SchedulerResult = {
    teamsConsidered: teams.length,
    teamsRun: 0,
    processed: 0,
    repliesDetected: 0,
    skipped: [],
  };

  for (const team of teams) {
    // Reply detection + auto-pause runs regardless of working hours — we always
    // want to stop automating a lead the moment they reply.
    const { detected } = await pollRepliesForTeam(team.id);
    result.repliesDetected += detected;

    const tz = team.limits?.timezone ?? team.timezone;
    const within =
      opts.ignoreWorkingHours ||
      isWithinWorkingHours(team.limits?.workingHours, tz);

    if (!within) {
      result.skipped.push({ teamId: team.id, teamName: team.name, reason: "working_hours" });
      continue;
    }

    const { processed } = await runDueSteps({ teamId: team.id });
    result.processed += processed;
    result.teamsRun++;
  }

  return result;
}
