/**
 * Minimal, dependency-free CSV parser. Handles quoted fields, escaped quotes
 * (""), commas and newlines inside quotes, and CRLF line endings.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = input.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // skip fully-empty lines
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  // trailing field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

// Header aliases → canonical lead field.
const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "full name", "氏名", "名前", "フルネーム"],
  firstName: ["firstname", "first name", "first", "名", "名前(名)"],
  lastName: ["lastname", "last name", "last", "姓", "名字", "苗字"],
  company: ["company", "organization", "org", "会社", "会社名", "企業", "企業名"],
  jobTitle: ["jobtitle", "job title", "title", "position", "役職", "肩書き", "職種"],
  location: ["location", "region", "所在地", "地域", "勤務地"],
  email: ["email", "e-mail", "mail", "メール", "メールアドレス"],
  profileUrl: ["profileurl", "profile url", "profile", "url", "linkedin", "linkedinurl", "linkedin url", "プロフィール", "プロフィールurl"],
  headline: ["headline", "見出し", "ヘッドライン"],
};

export interface ColumnMapping {
  [field: string]: number; // canonical field -> column index
}

/** Build a field→columnIndex map from a header row. */
export function detectMapping(header: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  header.forEach((raw, idx) => {
    const key = raw.trim().toLowerCase();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(key) && mapping[field] === undefined) {
        mapping[field] = idx;
      }
    }
  });
  return mapping;
}

export interface RawLeadRecord {
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  email?: string;
  profileUrl?: string;
  headline?: string;
}

/** Map CSV rows to raw records using a header-derived mapping. */
export function rowsToRecords(rows: string[][]): {
  records: RawLeadRecord[];
  mapping: ColumnMapping;
  hasHeader: boolean;
} {
  if (rows.length === 0) return { records: [], mapping: {}, hasHeader: false };
  const header = rows[0];
  const mapping = detectMapping(header);
  const hasHeader = Object.keys(mapping).length > 0;

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const cell = (row: string[], field: string): string | undefined => {
    const idx = mapping[field];
    if (idx === undefined) return undefined;
    const v = row[idx]?.trim();
    return v ? v : undefined;
  };

  const records = dataRows.map((row) => {
    if (!hasHeader) {
      // Positional fallback: name, company, jobTitle, location, email, profileUrl
      return {
        name: row[0]?.trim() || undefined,
        company: row[1]?.trim() || undefined,
        jobTitle: row[2]?.trim() || undefined,
        location: row[3]?.trim() || undefined,
        email: row[4]?.trim() || undefined,
        profileUrl: row[5]?.trim() || undefined,
      };
    }
    return {
      name: cell(row, "name"),
      firstName: cell(row, "firstName"),
      lastName: cell(row, "lastName"),
      company: cell(row, "company"),
      jobTitle: cell(row, "jobTitle"),
      location: cell(row, "location"),
      email: cell(row, "email"),
      profileUrl: cell(row, "profileUrl"),
      headline: cell(row, "headline"),
    };
  });

  return { records, mapping, hasHeader };
}
