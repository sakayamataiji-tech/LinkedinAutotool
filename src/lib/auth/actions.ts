"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, getSession, setActiveTeam } from "./session";
import { requireAuth } from "../session";

export interface AuthState {
  error?: string;
}

function normEmail(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().toLowerCase();
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const teamName = String(formData.get("teamName") ?? "").trim();

  if (!email || !name || !password || !teamName) {
    return { error: "すべての項目を入力してください。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上にしてください。" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "このメールアドレスは既に登録されています。" };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, name, passwordHash } });
  const team = await prisma.team.create({ data: { name: teamName } });
  await prisma.membership.create({ data: { teamId: team.id, userId: user.id, role: "OWNER" } });
  await prisma.dailyLimit.create({ data: { teamId: team.id } });

  await createSession(user.id, team.id);
  redirect("/");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください。" };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { id: "asc" } } },
  });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  await createSession(user.id, user.memberships[0]?.teamId ?? null);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function switchTeamAction(teamId: string) {
  const session = await requireAuth();
  if (!session.memberships.some((m) => m.teamId === teamId)) return;
  await setActiveTeam(session.sessionId, teamId);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createTeamAction(formData: FormData) {
  const session = await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const team = await prisma.team.create({ data: { name } });
  await prisma.membership.create({
    data: { teamId: team.id, userId: session.user.id, role: "OWNER" },
  });
  await prisma.dailyLimit.create({ data: { teamId: team.id } });
  await setActiveTeam(session.sessionId, team.id);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Invite an existing user (by email) into the current team. Full email
 * invitations are out of scope for the MVP; this links an already-registered
 * user as a team member.
 */
export async function inviteMemberAction(formData: FormData) {
  const session = await requireAuth();
  const activeTeamId =
    session.memberships.find((m) => m.teamId === session.activeTeamId)?.teamId ??
    session.memberships[0]?.teamId;
  if (!activeTeamId) return;

  const email = normEmail(formData.get("email"));
  const role = String(formData.get("role") ?? "MEMBER") === "ADMIN" ? "ADMIN" : "MEMBER";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // silently ignore unknown users in MVP

  await prisma.membership.upsert({
    where: { teamId_userId: { teamId: activeTeamId, userId: user.id } },
    update: { role },
    create: { teamId: activeTeamId, userId: user.id, role },
  });
  revalidatePath("/settings");
}
