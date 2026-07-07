"use client";

import { useState, useTransition } from "react";
import { addLeadsToCampaign } from "@/lib/actions";

export function AddLeads({
  campaignId,
  candidates,
}: {
  campaignId: string;
  candidates: { id: string; name: string; company: string | null }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  if (candidates.length === 0) {
    return <p className="text-sm text-slate-400">追加できる未割り当てのリードはありません。</p>;
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
        {candidates.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 py-2 text-sm last:border-0 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => toggle(c.id)}
            />
            <span className="text-slate-700">{c.name}</span>
            {c.company ? <span className="text-xs text-slate-400">· {c.company}</span> : null}
          </label>
        ))}
      </div>
      <button
        className="btn-primary mt-3"
        disabled={pending || selected.size === 0}
        onClick={() =>
          start(async () => {
            await addLeadsToCampaign(campaignId, Array.from(selected));
            setSelected(new Set());
          })
        }
      >
        {pending ? "追加中…" : `選択した ${selected.size} 件を追加`}
      </button>
    </div>
  );
}
