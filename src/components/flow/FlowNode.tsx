"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ACTION_LABELS, CONDITION_LABELS } from "@/components/SequenceBuilder";

export interface FlowNodeData {
  kind: "ACTION" | "DELAY" | "CONDITION";
  actionType: string | null;
  conditionType: string | null;
  delayMinutes: number | null;
  messageBody: string | null;
  variantCount: number;
  [key: string]: unknown;
}

const STYLES: Record<string, { ring: string; chip: string; icon: string; label: string }> = {
  ACTION: { ring: "border-brand-300", chip: "bg-brand-500", icon: "▶", label: "アクション" },
  DELAY: { ring: "border-amber-300", chip: "bg-amber-400", icon: "⏱", label: "待機" },
  CONDITION: { ring: "border-purple-300", chip: "bg-purple-400", icon: "◇", label: "条件分岐" },
};

export function delayLabel(m: number | null): string {
  const v = m ?? 0;
  return v >= 1440
    ? `${Math.round(v / 1440)}日 待機`
    : v >= 60
      ? `${Math.round(v / 60)}時間 待機`
      : `${v}分 待機`;
}

export function nodeTitle(d: {
  kind: string;
  actionType: string | null;
  conditionType: string | null;
  delayMinutes: number | null;
}): string {
  if (d.kind === "ACTION") return ACTION_LABELS[d.actionType ?? ""] ?? d.actionType ?? "アクション";
  if (d.kind === "DELAY") return delayLabel(d.delayMinutes);
  if (d.kind === "CONDITION") return CONDITION_LABELS[d.conditionType ?? ""] ?? "条件";
  return d.kind;
}

export function FlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const s = STYLES[d.kind] ?? STYLES.ACTION;
  return (
    <div
      className={`w-56 rounded-xl border bg-white shadow-sm transition ${s.ring} ${
        selected ? "ring-2 ring-brand-400 ring-offset-1" : "hover:shadow-md"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-slate-300" />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs text-white ${s.chip}`}>
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{s.label}</div>
          <div className="truncate text-sm font-medium text-slate-800">{nodeTitle(d)}</div>
        </div>
        {d.variantCount > 0 ? (
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
            A/B{d.variantCount}
          </span>
        ) : null}
      </div>
      {d.messageBody && d.variantCount === 0 ? (
        <p className="line-clamp-2 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
          {d.messageBody}
        </p>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-slate-300" />
    </div>
  );
}
