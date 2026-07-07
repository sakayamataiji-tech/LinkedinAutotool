import { prisma } from "./prisma";

/**
 * MVP session helper. Authentication is out of scope for the foundation, so we
 * resolve the first team as the "current" team. Replace with real auth later.
 */
export async function getCurrentTeam() {
  const team = await prisma.team.findFirst({ orderBy: { createdAt: "asc" } });
  if (!team) {
    throw new Error("No team found. Run `npm run db:seed`.");
  }
  return team;
}

export async function getCurrentTeamId(): Promise<string> {
  return (await getCurrentTeam()).id;
}
