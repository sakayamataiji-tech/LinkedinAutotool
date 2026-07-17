import { redirect } from "next/navigation";
import { getSession, type SessionContext } from "./auth/session";

/**
 * Require an authenticated session. Redirects to /login when absent.
 */
export async function requireAuth(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getCurrentUser() {
  return (await requireAuth()).user;
}

/**
 * Resolve the caller's active team. Uses the session's activeTeamId when it
 * points at a team the user still belongs to, otherwise falls back to the
 * first membership. Enforces tenant isolation: every data query is scoped by
 * the returned team id.
 */
export async function getCurrentTeam() {
  const session = await requireAuth();
  if (session.memberships.length === 0) {
    // Authenticated but belongs to no team — send to team creation.
    redirect("/teams/new");
  }
  const active =
    session.memberships.find((m) => m.teamId === session.activeTeamId) ??
    session.memberships[0];
  return active.team;
}

export async function getCurrentTeamId(): Promise<string> {
  return (await getCurrentTeam()).id;
}

/** Verify the current user belongs to the given team; redirect home if not. */
export async function assertTeamAccess(teamId: string): Promise<SessionContext> {
  const session = await requireAuth();
  if (!session.memberships.some((m) => m.teamId === teamId)) {
    redirect("/");
  }
  return session;
}
