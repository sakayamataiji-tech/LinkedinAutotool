"use client";

import { useState, useTransition } from "react";
import { runCampaign, setCampaignStatus } from "@/lib/actions";

export function CampaignControls({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-slate-400">{msg}</span> : null}
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await runCampaign(campaignId);
            setMsg(res ? `${res.processed} ステップ実行` : "実行完了");
          })
        }
      >
        {pending ? "実行中…" : "▶ 実行"}
      </button>
      {status === "RUNNING" ? (
        <button
          className="btn-ghost"
          disabled={pending}
          onClick={() => start(() => setCampaignStatus(campaignId, "PAUSED"))}
        >
          ⏸ 一時停止
        </button>
      ) : (
        <button
          className="btn-ghost"
          disabled={pending}
          onClick={() => start(() => setCampaignStatus(campaignId, "RUNNING"))}
        >
          再開
        </button>
      )}
      <a href={`/api/campaigns/${campaignId}/export`} className="btn-ghost">
        CSV
      </a>
    </div>
  );
}
