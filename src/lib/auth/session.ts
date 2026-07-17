import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "../prisma";

export const SESSION_COOKIE = "la_session";
const SESSION_DAYS = 30;

/** Create a DB session for a user and set the httpOnly cookie. */
export async function createSession(userId: string, activeTeamId: string | null) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, activeTeamId, expiresAt } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  store.delete(SESSION_COOKIE);
}

export interface SessionContext {
  sessionId: string;
  token: string;
  activeTeamId: string | null;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
  memberships: {
    teamId: string;
    role: string;
    team: { id: string; name: string };
  }[];
}

/** Resolve the current session from the cookie, or null if unauthenticated. */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          memberships: { include: { team: true }, orderBy: { id: "asc" } },
        },
      },
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  return {
    sessionId: session.id,
    token: session.token,
    activeTeamId: session.activeTeamId,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
    },
    memberships: session.user.memberships.map((m) => ({
      teamId: m.teamId,
      role: m.role,
      team: { id: m.team.id, name: m.team.name },
    })),
  };
}

/** Persist a new active team on the session (validated against memberships). */
export async function setActiveTeam(sessionId: string, teamId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { activeTeamId: teamId } });
}
