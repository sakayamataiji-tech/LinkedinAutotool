"use client";

import { useState, useTransition } from "react";
import { setLeadBlacklist, updateLeadNotes } from "@/lib/actions";

export function BlacklistButton({ leadId, blacklisted }: { leadId: string; blacklisted: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-ghost"
      disabled={pending}
      onClick={() => start(() => setLeadBlacklist(leadId, !blacklisted))}
    >
      {blacklisted ? "ブラックリスト解除" : "ブラックリストに追加"}
    </button>
  );
}

export function NotesEditor({ leadId, initial }: { leadId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <textarea
        className="input min-h-[100px] resize-y"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="メモを記録…"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await updateLeadNotes(leadId, value);
              setSaved(true);
            })
          }
        >
          {pending ? "保存中…" : "保存"}
        </button>
        {saved ? <span className="text-xs text-green-600">保存しました</span> : null}
      </div>
    </div>
  );
}
