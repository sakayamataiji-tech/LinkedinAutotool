"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  deleteSequenceNode,
  reorderSequenceNodes,
} from "@/lib/actions";
import {
  AddNodeForm,
  ACTION_LABELS,
  CONDITION_LABELS,
  type TemplateOption,
} from "@/components/SequenceBuilder";
import { VariantManager, type VariantStatView } from "@/components/VariantManager";

export interface CanvasNode {
  id: string;
  kind: "ACTION" | "DELAY" | "CONDITION";
  actionType: string | null;
  conditionType: string | null;
  delayMinutes: number | null;
  messageBody: string | null;
  variants: VariantStatView[];
}

const MESSAGE_ACTIONS = new Set(["MESSAGE", "INMAIL", "SEND_EMAIL"]);

const KIND_STYLE: Record<string, { bar: string; chip: string; icon: string }> = {
  ACTION: { bar: "bg-brand-500", chip: "bg-brand-50 text-brand-700", icon: "▶" },
  DELAY: { bar: "bg-amber-400", chip: "bg-amber-50 text-amber-700", icon: "⏱" },
  CONDITION: { bar: "bg-purple-400", chip: "bg-purple-50 text-purple-700", icon: "◇" },
};

function nodeTitle(node: CanvasNode): string {
  if (node.kind === "ACTION") return ACTION_LABELS[node.actionType ?? ""] ?? node.actionType ?? "";
  if (node.kind === "DELAY") {
    const m = node.delayMinutes ?? 0;
    return m >= 1440
      ? `${Math.round(m / 1440)}日 待機`
      : m >= 60
        ? `${Math.round(m / 60)}時間 待機`
        : `${m}分 待機`;
  }
  if (node.kind === "CONDITION") return `条件: ${CONDITION_LABELS[node.conditionType ?? ""] ?? ""}`;
  return node.kind;
}

type OptimisticAction =
  | { type: "remove"; id: string }
  | { type: "reorder"; ids: string[] };

function reducer(state: CanvasNode[], action: OptimisticAction): CanvasNode[] {
  if (action.type === "remove") return state.filter((n) => n.id !== action.id);
  if (action.type === "reorder") {
    const byId = new Map(state.map((n) => [n.id, n]));
    return action.ids.map((id) => byId.get(id)).filter((n): n is CanvasNode => Boolean(n));
  }
  return state;
}

function moveBefore(ids: string[], dragId: string, targetId: string): string[] {
  if (dragId === targetId) return ids;
  const without = ids.filter((id) => id !== dragId);
  const idx = without.indexOf(targetId);
  if (idx === -1) return ids;
  return [...without.slice(0, idx), dragId, ...without.slice(idx)];
}

export function SequenceCanvas({
  sequenceId,
  nodes,
  templates,
}: {
  sequenceId: string;
  nodes: CanvasNode[];
  templates: TemplateOption[];
}) {
  const [optimistic, applyOptimistic] = useOptimistic(nodes, reducer);
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const remove = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: "remove", id });
      await deleteSequenceNode(id, sequenceId);
    });
  };

  const commitReorder = (dragId: string, targetId: string) => {
    const ids = moveBefore(
      optimistic.map((n) => n.id),
      dragId,
      targetId,
    );
    if (ids.join() === optimistic.map((n) => n.id).join()) return;
    startTransition(async () => {
      applyOptimistic({ type: "reorder", ids });
      await reorderSequenceNodes(sequenceId, ids);
    });
  };

  return (
    <div>
      {optimistic.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          まだステップがありません。下の「＋ ステップを追加」から始めましょう。
        </div>
      ) : (
        <div>
          {optimistic.map((node, i) => {
            const style = KIND_STYLE[node.kind];
            const isDragging = dragId === node.id;
            const isOver = overId === node.id && dragId !== node.id;
            return (
              <div key={node.id}>
                {/* drop indicator */}
                <div className={`ml-9 h-1 rounded transition-colors ${isOver ? "bg-brand-400" : "bg-transparent"}`} />
                <div
                  draggable
                  onDragStart={(e) => {
                    setDragId(node.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverId(node.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) commitReorder(dragId, node.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  className={`group relative rounded-xl border border-slate-200 bg-white shadow-sm transition-all ${
                    isDragging ? "opacity-40" : "hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-2 p-3.5">
                    {/* drag handle */}
                    <span
                      className="mt-0.5 cursor-grab select-none text-slate-300 active:cursor-grabbing group-hover:text-slate-400"
                      title="ドラッグして並べ替え"
                    >
                      ⠿
                    </span>
                    {/* number + icon */}
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${style.chip}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${style.bar}`} />
                        <span className="text-sm font-medium text-slate-800">{nodeTitle(node)}</span>
                      </div>
                      {node.messageBody && node.variants.length === 0 ? (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">
                          {node.messageBody}
                        </p>
                      ) : null}
                      {node.kind === "ACTION" && MESSAGE_ACTIONS.has(node.actionType ?? "") ? (
                        <VariantManager nodeId={node.id} variants={node.variants} />
                      ) : null}
                    </div>
                    <button
                      className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      onClick={() => remove(node.id)}
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {i < optimistic.length - 1 ? (
                  <div className="ml-9 h-5 w-px bg-slate-200" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Add step */}
      <div className="mt-4">
        {adding ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">ステップを追加</span>
              <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setAdding(false)}>
                閉じる
              </button>
            </div>
            <AddNodeForm sequenceId={sequenceId} templates={templates} onAdded={() => setAdding(false)} />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-3 text-sm font-medium text-brand-600 transition hover:border-brand-300 hover:bg-brand-50"
          >
            ＋ ステップを追加
          </button>
        )}
      </div>
    </div>
  );
}
