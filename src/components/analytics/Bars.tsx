import type { Breakdown, FunnelStage } from "@/lib/analytics";

const PALETTE = ["#3282ff", "#8ec6ff", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

/** Horizontal funnel: each stage as a bar, width relative to the first stage. */
export function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const top = Math.max(1, stages[0]?.count ?? 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const pct = Math.round((s.count / top) * 100);
        const conv = i === 0 ? 100 : Math.round((s.count / top) * 100);
        return (
          <div key={s.key}>
            <div className="mb-0.5 flex items-center justify-between text-xs">
              <span className="text-slate-600">{s.label}</span>
              <span className="text-slate-400">
                {s.count}
                {i > 0 ? <span className="ml-1 text-slate-300">({conv}%)</span> : null}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded bg-slate-100">
              <div
                className="flex h-full items-center rounded"
                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Simple labelled horizontal bars for a breakdown. */
export function BreakdownBars({ items }: { items: Breakdown[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">この期間のデータはありません。</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.key} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-slate-500">{it.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded"
              style={{ width: `${(it.count / max) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-600">{it.count}</span>
        </div>
      ))}
    </div>
  );
}
