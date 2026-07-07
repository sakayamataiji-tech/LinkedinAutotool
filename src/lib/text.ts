/**
 * Clean unwanted substrings out of a lead's display name:
 * honorifics, academic degrees, emojis and other decorations. Mirrors the
 * "リード名に含まれる敬称・学位・絵文字などの不要文字列の自動除去" feature.
 */
const HONORIFICS = [
  "Dr.",
  "Dr",
  "Mr.",
  "Mr",
  "Mrs.",
  "Mrs",
  "Ms.",
  "Ms",
  "Prof.",
  "Prof",
  "Sir",
  "Miss",
];

const DEGREES = [
  "PhD",
  "Ph.D.",
  "MBA",
  "MSc",
  "MS",
  "BSc",
  "BA",
  "MD",
  "CPA",
  "PMP",
  "CFA",
  "Esq.",
  "Esq",
];

// Strip emoji and pictographic symbols.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu;

export function cleanName(raw: string): string {
  let s = raw.replace(EMOJI_RE, "");
  // remove degrees that usually trail after a comma: "Jane Doe, PhD, MBA"
  s = s.replace(/,\s*[^,]+$/g, (m) => {
    const tail = m.slice(1).trim();
    return DEGREES.some((d) => tail.toLowerCase().includes(d.toLowerCase())) ? "" : m;
  });
  const tokens = s
    .split(/\s+/)
    .map((t) => t.replace(/[.,]+$/g, ""))
    .filter((t) => t.length > 0)
    .filter(
      (t) =>
        !HONORIFICS.some((h) => h.toLowerCase() === (t + ".").toLowerCase() || h.toLowerCase() === t.toLowerCase()) &&
        !DEGREES.some((d) => d.toLowerCase() === t.toLowerCase()),
    );
  return tokens.join(" ").trim();
}

export interface TemplateVars {
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
}

/** Interpolate {{firstName}}, {{lastName}}, {{company}}, {{jobTitle}}. */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body
    .replace(/\{\{\s*firstName\s*\}\}/g, vars.firstName)
    .replace(/\{\{\s*lastName\s*\}\}/g, vars.lastName)
    .replace(/\{\{\s*company\s*\}\}/g, vars.company ?? "")
    .replace(/\{\{\s*jobTitle\s*\}\}/g, vars.jobTitle ?? "");
}
