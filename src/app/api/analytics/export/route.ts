import { getCurrentTeamId } from "@/lib/session";
import { teamAnalytics } from "@/lib/analytics";

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const teamId = await getCurrentTeamId();
  const url = new URL(req.url);
  const days = [7, 14, 30, 90].includes(Number(url.searchParams.get("days")))
    ? Number(url.searchParams.get("days"))
    : 30;

  const a = await teamAnalytics(teamId, days);

  const lines: string[] = [];
  lines.push("# 日次トレンド");
  lines.push(["date", "connectionsSent", "messagesSent", "replies", "profileViews"].map(cell).join(","));
  for (const d of a.daily) {
    lines.push([d.date, d.connectionsSent, d.messagesSent, d.replies, d.profileViews].map(cell).join(","));
  }
  lines.push("");
  lines.push("# キャンペーン比較");
  lines.push(["campaign", "status", "leads", "connectionsSent", "acceptanceRate", "messagesSent", "replyRate"].map(cell).join(","));
  for (const c of a.campaigns) {
    lines.push(
      [c.name, c.status, c.leads, c.connectionsSent, c.acceptanceRate.toFixed(3), c.messagesSent, c.replyRate.toFixed(3)]
        .map(cell)
        .join(","),
    );
  }
  if (a.variants.length > 0) {
    lines.push("");
    lines.push("# A/Bバリアント比較");
    lines.push(["sequence", "step", "variant", "sent", "replied", "replyRate"].map(cell).join(","));
    for (const v of a.variants) {
      lines.push([v.sequence, v.node, v.label, v.sent, v.replied, v.replyRate.toFixed(3)].map(cell).join(","));
    }
  }

  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${days}d.csv"`,
    },
  });
}
