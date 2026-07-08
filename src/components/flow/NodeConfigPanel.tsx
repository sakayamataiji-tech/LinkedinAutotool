"use client";

import { useState, useTransition } from "react";
import { updateSequenceNode, deleteSequenceNode } from "@/lib/actions";
import {
  ACTION_LABELS,
  CONDITION_LABELS,
  type TemplateOption,
} from "@/components/SequenceBuilder";
import { VariantManager, type VariantStatView } from "@/components/VariantManager";

const MESSAGE_ACTIONS = new Set(["MESSAGE", "INMAIL", "SEND_EMAIL"]);

export interface EditableNode {
  id: string;
  kind: "ACTION" | "DELAY" | "CONDITION";
  actionType: string | null;
  conditionType: string | null;
  delayMinutes: number | null;
  messageBody: string | null;
  variants: VariantStatView[];
}

export function NodeConfigPanel({
  node,
  sequenceId,
  templates,
  onClose,
  onSaved,
  onDeleted,
}: {
  node: EditableNode;
  sequenceId: string;
  templates: TemplateOption[];
  onClose: () => void;
  onSaved: (patch: Partial<EditableNode>) => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState(node.messageBody ?? "");
  const [delayValue, setDelayValue] = useState(() => {
    const m = node.delayMinutes ?? 1440;
    return m >= 1440 ? m / 1440 : m >= 60 ? m / 60 : m;
  });
  const [delayUnit, setDelayUnit] = useState(() => {
    const m = node.delayMinutes ?? 1440;
    return m >= 1440 ? "day" : m >= 60 ? "hour" : "min";
  });
  const [conditionType, setConditionType] = useState(node.conditionType ?? "IS_CONNECTED");
  const [saved, setSaved] = useState(false);

  const isMessage = node.kind === "ACTION" && MESSAGE_ACTIONS.has(node.actionType ?? "");

  const save = () => {
    start(async () => {
      if (node.kind === "DELAY") {
        const mult = delayUnit === "day" ? 1440 : delayUnit === "hour" ? 60 : 1;
        const minutes = Math.max(1, Math.round(delayValue * mult));
        await updateSequenceNode(node.id, { delayMinutes: minutes });
        onSaved({ delayMinutes: minutes });
      } else if (node.kind === "CONDITION") {
        await updateSequenceNode(node.id, { conditionType });
        onSaved({ conditionType });
      } else if (isMessage) {
        await updateSequenceNode(node.id, { messageBody: body });
        onSaved({ messageBody: body });
      }
      setSaved(true);
    });
  };

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">ステップの設定</h3>
        <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          種別:{" "}
          <b className="text-slate-700">
            {node.kind === "ACTION"
              ? (ACTION_LABELS[node.actionType ?? ""] ?? node.actionType)
              : node.kind === "DELAY"
                ? "待機"
                : "条件分岐"}
          </b>
        </div>

        {node.kind === "DELAY" ? (
          <div>
            <label className="label">待機時間</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="input"
                value={delayValue}
                onChange={(e) => setDelayValue(Number(e.target.value))}
              />
              <select className="input max-w-[110px]" value={delayUnit} onChange={(e) => setDelayUnit(e.target.value)}>
                <option value="min">分</option>
                <option value="hour">時間</option>
                <option value="day">日</option>
              </select>
            </div>
          </div>
        ) : null}

        {node.kind === "CONDITION" ? (
          <div>
            <label className="label">条件</label>
            <select className="input" value={conditionType} onChange={(e) => setConditionType(e.target.value)}>
              {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {isMessage ? (
          <>
            {templates.length > 0 ? (
              <div>
                <label className="label">テンプレートから挿入</label>
                <select
                  className="input"
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) setBody(t.body);
                  }}
                >
                  <option value="">選択…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="label">本文（{"{{firstName}}"} 等が使えます）</label>
              <textarea
                className="input min-h-[120px]"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">A/Bテスト</div>
              <VariantManager nodeId={node.id} variants={node.variants} />
            </div>
          </>
        ) : null}

        {node.kind === "ACTION" && !isMessage ? (
          <p className="text-xs text-slate-400">
            このアクション（{ACTION_LABELS[node.actionType ?? ""] ?? node.actionType}）に設定項目はありません。
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 p-4">
        <button
          className="text-xs text-red-500 hover:text-red-700"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deleteSequenceNode(node.id, sequenceId);
              onDeleted();
            })
          }
        >
          このステップを削除
        </button>
        {node.kind !== "ACTION" || isMessage ? (
          <div className="flex items-center gap-2">
            {saved ? <span className="text-xs text-green-600">保存しました</span> : null}
            <button className="btn-primary !py-1.5" disabled={pending} onClick={save}>
              {pending ? "保存中…" : "保存"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
