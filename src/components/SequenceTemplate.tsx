"use client";

import { useState, useTransition } from "react";
import { updateSequenceNode } from "@/lib/actions";
import { ACTION_LABELS, CONDITION_LABELS } from "@/components/SequenceBuilder";
import { VariantManager, type VariantStatView } from "@/components/VariantManager";

const MESSAGE_ACTIONS = new Set(["MESSAGE", "INMAIL", "SEND_EMAIL"]);

export interface TemplateStep {
  id: string;
  kind: "ACTION" | "DELAY" | "CONDITION";
  actionType: string | null;
  conditionType: string | null;
  delayMinutes: number | null;
  messageBody: string | null;
  variants: VariantStatView[];
}

function delayLabel(m: number | null): string {
  const v = m ?? 0;
  if (v >= 1440) return `${Math.round(v / 1440)}日 待つ`;
  if (v >= 60) return `${Math.round(v / 60)}時間 待つ`;
  return `${v}分 待つ`;
}

function stepMeta(step: TemplateStep): { icon: string; badge: string; tone: string; title: string } {
  if (step.kind === "DELAY") {
    return {
      icon: "⏱",
      badge: "待機",
      tone: "bg-amber-50 text-amber-600 ring-amber-100",
      title: delayLabel(step.delayMinutes),
    };
  }
  if (step.kind === "CONDITION") {
    return {
      icon: "◇",
      badge: "条件分岐",
      tone: "bg-purple-50 text-purple-600 ring-purple-100",
      title: CONDITION_LABELS[step.conditionType ?? ""] ?? "条件",
    };
  }
  const isMsg = MESSAGE_ACTIONS.has(step.actionType ?? "");
  return {
    icon: isMsg ? "✉" : "▶",
    badge: "アクション",
    tone: "bg-brand-50 text-brand-600 ring-brand-100",
    title: ACTION_LABELS[step.actionType ?? ""] ?? step.actionType ?? "アクション",
  };
}

function MessageEditor({ step }: { step: TemplateStep }) {
  const [body, setBody] = useState(step.messageBody ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const hasVariants = step.variants.length > 0;

  return (
    <div className="mt-3">
      {hasVariants ? (
        <p className="mb-2 text-xs text-slate-400">
          A/Bテストが有効です。各バリアントの文面を編集してください。
        </p>
      ) : (
        <>
          <textarea
            className="input min-h-[110px] text-sm leading-relaxed"
            placeholder="はじめまして {{firstName}} さん、"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(false);
            }}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              className="btn-primary !py-1.5 text-xs"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await updateSequenceNode(step.id, { messageBody: body });
                  setSaved(true);
                })
              }
            >
              {pending ? "保存中…" : "文面を保存"}
            </button>
            {saved ? <span className="text-xs text-green-600">保存しました</span> : null}
            <span className="text-xs text-slate-400">
              {"{{firstName}}"} / {"{{company}}"} が使えます
            </span>
          </div>
        </>
      )}
      <VariantManager nodeId={step.id} variants={step.variants} />
    </div>
  );
}

export function SequenceTemplate({ steps }: { steps: TemplateStep[] }) {
  return (
    <div className="relative">
      {/* connecting rail */}
      <div className="absolute left-[27px] top-4 bottom-4 w-px bg-slate-200" aria-hidden />
      <ol className="space-y-4">
        {steps.map((step, i) => {
          const meta = stepMeta(step);
          const isMsg =
            step.kind === "ACTION" && MESSAGE_ACTIONS.has(step.actionType ?? "");
          return (
            <li key={step.id} className="relative flex gap-4">
              <div
                className={`z-10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ${meta.tone}`}
              >
                <span>{meta.icon}</span>
                <span className="text-[9px] font-medium tabular-nums text-slate-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {meta.badge}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-800">{meta.title}</div>
                {isMsg ? (
                  <MessageEditor step={step} />
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    {step.kind === "DELAY"
                      ? "承認や返信を待つための待機ステップです。"
                      : step.kind === "CONDITION"
                        ? "条件によって以降のステップを分岐します。"
                        : "自動で実行されるアクションです。"}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
