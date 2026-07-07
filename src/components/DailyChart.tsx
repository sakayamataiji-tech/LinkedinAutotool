import type { DailyPoint } from "@/lib/metrics";

/** Minimal grouped bar chart (connections vs messages) rendered as inline SVG. */
export function DailyChart({ data }: { data: DailyPoint[] }) {
  const w = 560;
  const h = 160;
  const pad = 24;
  const max = Math.max(1, ...data.map((d) => Math.max(d.connectionsSent, d.messagesSent)));
  const bw = (w - pad * 2) / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="日次アクティビティ">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e2e8f0" />
      {data.map((d, i) => {
        const x = pad + i * bw;
        const ch = ((h - pad * 2) * d.connectionsSent) / max;
        const mh = ((h - pad * 2) * d.messagesSent) / max;
        const bar = bw * 0.28;
        return (
          <g key={d.date}>
            <rect
              x={x + bw / 2 - bar - 1}
              y={h - pad - ch}
              width={bar}
              height={ch}
              rx={1.5}
              fill="#3282ff"
            />
            <rect
              x={x + bw / 2 + 1}
              y={h - pad - mh}
              width={bar}
              height={mh}
              rx={1.5}
              fill="#8ec6ff"
            />
            {i % 2 === 0 ? (
              <text
                x={x + bw / 2}
                y={h - pad + 12}
                textAnchor="middle"
                fontSize="8"
                fill="#94a3b8"
              >
                {d.date.slice(5)}
              </text>
            ) : null}
          </g>
        );
      })}
      <g>
        <rect x={pad} y={6} width={8} height={8} rx={2} fill="#3282ff" />
        <text x={pad + 12} y={13} fontSize="9" fill="#64748b">接続</text>
        <rect x={pad + 48} y={6} width={8} height={8} rx={2} fill="#8ec6ff" />
        <text x={pad + 60} y={13} fontSize="9" fill="#64748b">メッセージ</text>
      </g>
    </svg>
  );
}
