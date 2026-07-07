import { prisma } from "../prisma";
import { cleanName } from "../text";
import type { RawLeadRecord } from "../csv";
import type { LeadSource } from "@prisma/client";

export interface ImportSummary {
  total: number;
  imported: number;
  skippedDuplicate: number;
  skippedInvalid: number;
}

interface NormalizedLead {
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  email: string | null;
  profileUrl: string | null;
  headline: string | null;
}

/** Turn a raw record into a normalized lead (name cleaned), or null if unusable. */
function normalize(rec: RawLeadRecord): NormalizedLead | null {
  let firstName = "";
  let lastName = "";

  if (rec.firstName || rec.lastName) {
    firstName = cleanName(rec.firstName ?? "");
    lastName = cleanName(rec.lastName ?? "");
  } else if (rec.name) {
    const clean = cleanName(rec.name);
    const parts = clean.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }

  if (!firstName && !lastName) return null;

  return {
    firstName: firstName || lastName,
    lastName: firstName ? lastName : "",
    company: rec.company ?? null,
    jobTitle: rec.jobTitle ?? null,
    location: rec.location ?? null,
    email: rec.email?.toLowerCase() ?? null,
    profileUrl: rec.profileUrl ?? null,
    headline: rec.headline ?? null,
  };
}

function dedupeKey(l: { firstName: string; lastName: string; company: string | null }): string {
  return `${l.firstName}|${l.lastName}|${l.company ?? ""}`.toLowerCase();
}

/**
 * Import a batch of raw records for a team. Cleans names, skips duplicates
 * (against existing leads and within the batch), optionally tags and enrolls
 * into a campaign.
 */
export async function bulkImportLeads(
  teamId: string,
  records: RawLeadRecord[],
  opts: { source: LeadSource; tagNames?: string[]; campaignId?: string | null },
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    total: records.length,
    imported: 0,
    skippedDuplicate: 0,
    skippedInvalid: 0,
  };

  // Existing lead fingerprints for dedup.
  const existing = await prisma.lead.findMany({
    where: { teamId },
    select: { email: true, profileUrl: true, firstName: true, lastName: true, company: true },
  });
  const seenEmail = new Set(existing.filter((e) => e.email).map((e) => e.email!.toLowerCase()));
  const seenUrl = new Set(existing.filter((e) => e.profileUrl).map((e) => e.profileUrl!));
  const seenKey = new Set(existing.map(dedupeKey));

  // Resolve / create tags once.
  const tagIds: string[] = [];
  for (const name of opts.tagNames ?? []) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const tag = await prisma.tag.upsert({
      where: { teamId_name: { teamId, name: trimmed } },
      update: {},
      create: { teamId, name: trimmed },
    });
    tagIds.push(tag.id);
  }

  for (const rec of records) {
    const lead = normalize(rec);
    if (!lead) {
      summary.skippedInvalid++;
      continue;
    }
    const key = dedupeKey(lead);
    const dup =
      (lead.email && seenEmail.has(lead.email)) ||
      (lead.profileUrl && seenUrl.has(lead.profileUrl)) ||
      seenKey.has(key);
    if (dup) {
      summary.skippedDuplicate++;
      continue;
    }
    if (lead.email) seenEmail.add(lead.email);
    if (lead.profileUrl) seenUrl.add(lead.profileUrl);
    seenKey.add(key);

    const created = await prisma.lead.create({
      data: {
        teamId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        jobTitle: lead.jobTitle,
        location: lead.location,
        email: lead.email,
        emailStatus: lead.email ? "found" : "unknown",
        profileUrl: lead.profileUrl,
        headline: lead.headline,
        source: opts.source,
        tags: tagIds.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
    });

    if (opts.campaignId) {
      await prisma.campaignLead.upsert({
        where: { campaignId_leadId: { campaignId: opts.campaignId, leadId: created.id } },
        update: {},
        create: { campaignId: opts.campaignId, leadId: created.id },
      });
    }

    summary.imported++;
  }

  return summary;
}
