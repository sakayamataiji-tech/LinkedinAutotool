"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTeamId } from "../session";
import { parseCsv, rowsToRecords, type RawLeadRecord } from "../csv";
import { bulkImportLeads, type ImportSummary } from "./bulk";
import type { LeadSource } from "@prisma/client";

export interface ImportState {
  ok?: boolean;
  error?: string;
  summary?: ImportSummary;
}

function parseTags(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function common(formData: FormData) {
  const tagNames = parseTags(formData.get("tags"));
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  return { tagNames, campaignId };
}

/** Import from an uploaded CSV file. */
export async function importCsvAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const teamId = await getCurrentTeamId();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "CSVファイルを選択してください。" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "ファイルサイズが大きすぎます（上限5MB）。" };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { error: "ファイルを読み込めませんでした。" };
  }

  const rows = parseCsv(text);
  const { records } = rowsToRecords(rows);
  if (records.length === 0) {
    return { error: "取り込めるデータがありませんでした。ヘッダー行と列をご確認ください。" };
  }

  const { tagNames, campaignId } = common(formData);
  const summary = await bulkImportLeads(teamId, records, {
    source: "CSV_IMPORT",
    tagNames,
    campaignId,
  });
  revalidatePath("/leads");
  return { ok: true, summary };
}

/** Import from a pasted list of LinkedIn profile URLs (one per line). */
export async function importProfileUrlsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const teamId = await getCurrentTeamId();
  const urls = String(formData.get("urls") ?? "")
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  if (urls.length === 0) return { error: "プロフィールURLを1行に1件入力してください。" };

  // Derive a provisional name from the profile slug (…/in/john-doe).
  const records: RawLeadRecord[] = urls.map((url) => {
    const slug = url.replace(/\/+$/, "").split("/").pop() ?? "";
    const name = slug
      .replace(/-\d+$/, "")
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    return { name: name || "LinkedIn Lead", profileUrl: url };
  });

  const { tagNames, campaignId } = common(formData);
  const summary = await bulkImportLeads(teamId, records, {
    source: "PROFILE_URL",
    tagNames,
    campaignId,
  });
  revalidatePath("/leads");
  return { ok: true, summary };
}

// Mock data pools for demonstrating source-based ingestion.
const FIRST = ["太郎", "花子", "健一", "美咲", "翔太", "陽菜", "James", "Emma", "Liam", "Olivia", "Noah", "Sophia"];
const LAST = ["田中", "鈴木", "佐藤", "山本", "中村", "小林", "Carter", "Wilson", "Brown", "Davis", "Martin", "Clark"];
const COMPANIES = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Soylent", "Stark Industries", "Wayne Ent.", "Cyberdyne", "Tyrell Corp"];
const TITLES = ["VP of Sales", "CTO", "採用マネージャー", "事業開発", "マーケティング部長", "COO", "Head of People", "Product Lead"];
const LOCATIONS = ["東京", "大阪", "名古屋", "福岡", "San Francisco", "London", "Berlin", "New York"];

/**
 * Generate mock leads for a given ingestion source. In production these would
 * come from scraping LinkedIn/Sales Navigator/Recruiter search results, event
 * attendee lists, post likers/commenters, or first-degree connections. Here we
 * synthesize them so the whole ingestion flow is exercisable.
 */
export async function importMockSourceAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const teamId = await getCurrentTeamId();
  const source = String(formData.get("source") ?? "LINKEDIN_SEARCH") as LeadSource;
  const count = Math.min(Math.max(Number(formData.get("count") ?? 10) || 10, 1), 50);

  // Deterministic-ish variety without Math.random dependence on any seed.
  const records: RawLeadRecord[] = Array.from({ length: count }).map((_, i) => {
    const f = FIRST[(i * 7 + 3) % FIRST.length];
    const l = LAST[(i * 5 + 1) % LAST.length];
    const company = COMPANIES[(i * 3) % COMPANIES.length];
    return {
      firstName: f,
      lastName: l,
      company,
      jobTitle: TITLES[(i * 2) % TITLES.length],
      location: LOCATIONS[i % LOCATIONS.length],
      profileUrl: `https://www.linkedin.com/in/${f}-${l}-${source.toLowerCase()}-${i}`.toLowerCase(),
    };
  });

  const { tagNames, campaignId } = common(formData);
  const summary = await bulkImportLeads(teamId, records, { source, tagNames, campaignId });
  revalidatePath("/leads");
  return { ok: true, summary };
}
