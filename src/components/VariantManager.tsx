"use client";

import { useState, useTransition } from "react";
import { enableAbTest, addVariant, updateVariant, deleteVariant } from "@/lib/actions";

export interface VariantStatView {
  id: string;
  label: string;
  body: string;
  subject: string | null;
  sent: number;
  recipients: number;
  replied: number;
  replyRate: number;
}

function VariantEditor({ variant, best }: { variant: VariantStatView; best: boolean }) {
  const [body, setBody] = useState(variant.body);
  const [subject, setSubject] = useState(variant.subject ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {variant.label}
          </span>
          {best && variant.recipients > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              最高返信率
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>送信 {variant.sent}</span>
          <span>返信 {variant.replied}</span>
          <span className="font-medium text-slate-700">
            返信率 {Math.round(variant.replyRate * 100)}%
          </span>
          <button
            className="text-red-500 hover:underline"
            disabled={pending}
            onClick={() => start(() => deleteVariant(variant.id))}
          >
            削除
          </button>
        </div>
      </div>
      <textarea
        className="input min-h-[64px] text-sm"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          className="btn-ghost !py-1 text-xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await updateVariant(variant.id, body, subject);
              setSaved(true);
            })
          }
        >
          保存
        </button>
        {saved ? <span className="text-xs text-green-600">保存しました</span> : null}
      </div>
    </div>
  );
}

export function VariantManager({
  nodeId,
  variants,
}: {
  nodeId: string;
  variants: VariantStatView[];
}) {
  const [pending, start] = useTransition();

  if (variants.length === 0) {
    return (
      <button
        className="mt-2 text-xs font-medium text-brand-600 hover:underline"
        disabled={pending}
        onClick={() => start(() => enableAbTest(nodeId))}
      >
        + A/Bテストを有効化
      </button>
    );
  }

  const maxRate = Math.max(...variants.filter((v) => v.recipients > 0).map((v) => v.replyRate), -1);

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-600">A/Bテスト（{variants.length}バリアント）</div>
      <div className="space-y-2">
        {variants.map((v) => (
          <VariantEditor key={v.id} variant={v} best={v.recipients > 0 && v.replyRate === maxRate} />
        ))}
      </div>
      <button
        className="mt-2 text-xs font-medium text-brand-600 hover:underline"
        disabled={pending || variants.length >= 6}
        onClick={() => start(() => addVariant(nodeId))}
      >
        + バリアントを追加
      </button>
    </div>
  );
}
