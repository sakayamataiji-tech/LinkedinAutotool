"use client";

import { useState, useTransition } from "react";
import { updateWorkingHours, runSchedulerNow } from "@/lib/actions";

interface Day {
  enabled: boolean;
  start: string;
  end: string;
}

const LABELS = ["月", "火", "水", "木", "金", "土", "日"];

const DEFAULT: Day[] = Array.from({ length: 7 }).map((_, i) => ({
  enabled: i < 5,
  start: "09:00",
  end: "18:00",
}));

export function WorkingHoursEditor({
  initial,
  timezone,
}: {
  initial: Day[] | null;
  timezone: string;
}) {
  const days = initial && initial.length === 7 ? initial : DEFAULT;
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(fd) =>
        start(async () => {
          await updateWorkingHours(fd);
          setSaved(true);
        })
      }
      className="space-y-2"
    >
      <div className="mb-2">
        <label className="label">タイムゾーン</label>
        <input name="timezone" defaultValue={timezone} className="input" />
      </div>
      {days.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <label className="flex w-16 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name={`wh_${i}_enabled`} defaultChecked={d.enabled} />
            {LABELS[i]}曜
          </label>
          <input
            type="time"
            name={`wh_${i}_start`}
            defaultValue={d.start}
            className="input max-w-[120px]"
          />
          <span className="text-slate-400">–</span>
          <input
            type="time"
            name={`wh_${i}_end`}
            defaultValue={d.end}
            className="input max-w-[120px]"
          />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "保存中…" : "稼働時間を保存"}
        </button>
        {saved ? <span className="text-xs text-green-600">保存しました</span> : null}
      </div>
    </form>
  );
}

export function RunNowButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runSchedulerNow();
            setMsg(
              `実行: ${r.processed} ステップ · 返信検知 ${r.repliesDetected} · Webhook配信 ${r.webhooksDelivered}`,
            );
          })
        }
      >
        {pending ? "実行中…" : "今すぐ全キャンペーンを実行"}
      </button>
      {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
    </div>
  );
}
