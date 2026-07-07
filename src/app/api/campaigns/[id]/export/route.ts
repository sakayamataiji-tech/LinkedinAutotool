import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const teamId = await getCurrentTeamId();

  const campaign = await prisma.campaign.findFirst({ where: { id, teamId } });
  if (!campaign) return new Response("Not found", { status: 404 });

  const rows = await prisma.campaignLead.findMany({
    where: { campaignId: id },
    include: { lead: true },
    orderBy: { updatedAt: "desc" },
  });

  const header = [
    "firstName",
    "lastName",
    "company",
    "jobTitle",
    "location",
    "email",
    "status",
    "connectionAccepted",
    "replied",
    "profileUrl",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.lead.firstName,
        r.lead.lastName,
        r.lead.company,
        r.lead.jobTitle,
        r.lead.location,
        r.lead.email,
        r.status,
        r.connectionAccepted,
        r.replied,
        r.lead.profileUrl,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campaign-${id}.csv"`,
    },
  });
}
