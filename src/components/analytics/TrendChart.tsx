import type { DailyPoint } from "@/lib/analytics";

const SERIES = [
  { key: "connectionsSent", label: "接続", color: "#3282ff" },
  { key: "messagesSent", label: "メッセージ", color: "#8ec6ff" },
  { key: "replies", label: "返信", color: "#10b981" },
] as const;

/** Multi-series line chart (inline SVG) for the daily trend. */
export function TrendChart({ data }: { data: DailyPoint[] }) {
  const w = 720;
  const h = 240;
  const padX = 32;
  const padY = 24;
  const max = Math.max(
    1,
    ...data.flatMap((d) => SERIES.map((s) => d[s.key] as number)),
  );
  const n = Math.max(1, data.length - 1);
  const x = (i: number) => padX + (i * (w - padX * 2)) / n;
  const y = (v: number) => h - padY - (v * (h - padY * 2)) / max;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[520px]" role="img" aria-label="日次トレンド">
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={w - padX}
            y1={padY + f * (h - padY * 2)}
            y2={padY + f * (h - padY * 2)}
            stroke="#f1f5f9"
          />
        ))}
        <text x={padX} y={padY - 8} fontSize="9" fill="#94a3b8">{max}</text>

        {SERIES.map((s) => {
          const pts = data.map((d, i) => `${x(i)},${y(d[s.key] as number)}`).join(" ");
          return (
            <g key={s.key}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d[s.key] as number)} r={2} fill={s.color} />
              ))}
            </g>
          );
        })}

        {/* x labels: show ~6 ticks */}
        {data.map((d, i) => {
          const step = Math.ceil(data.length / 6);
          if (i % step !== 0) return null;
          return (
            <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-4 rounded" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
