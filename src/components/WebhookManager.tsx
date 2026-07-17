"use client";

import { useState, useTransition } from "react";
import { createWebhook, deleteWebhook, toggleWebhook, testWebhook } from "@/lib/actions";
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";

export interface WebhookView {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string | null;
  deliveries: {
    id: string;
    event: string;
    statusCode: number | null;
    success: boolean;
    createdAt: string;
  }[];
}

function EventBadges({ events }: { events: string[] }) {
  if (events.length === 0)
    return <span className="text-xs text-slate-400">全イベント</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {events.map((e) => (
        <span key={e} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
          {e}
        </span>
      ))}
    </div>
  );
}

function WebhookRow({ webhook }: { webhook: WebhookView }) {
  const [pending, start] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${webhook.active ? "bg-green-500" : "bg-slate-300"}`}
            />
            <span className="truncate text-sm font-medium text-slate-700">{webhook.url}</span>
          </div>
          <div className="mt-1">
            <EventBadges events={webhook.events} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className="btn-ghost !px-2 !py-1 text-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const ok = await testWebhook(webhook.id);
                setTestMsg(ok ? "送信成功" : "送信失敗");
              })
            }
          >
            テスト送信
          </button>
          <button
            className="btn-ghost !px-2 !py-1 text-xs"
            disabled={pending}
            onClick={() => start(() => toggleWebhook(webhook.id, !webhook.active))}
          >
            {webhook.active ? "無効化" : "有効化"}
          </button>
          <button
            className="!px-2 !py-1 text-xs text-red-500 hover:text-red-700"
            disabled={pending}
            onClick={() => start(() => deleteWebhook(webhook.id))}
          >
            削除
          </button>
        </div>
      </div>

      {webhook.secret ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span>署名シークレット:</span>
          <code className="rounded bg-slate-50 px-1.5 py-0.5">
            {showSecret ? webhook.secret : "whsec_••••••••••••"}
          </code>
          <button className="text-brand-600" onClick={() => setShowSecret((v) => !v)}>
            {showSecret ? "隠す" : "表示"}
          </button>
          {testMsg ? <span className="text-slate-500">· {testMsg}</span> : null}
        </div>
      ) : null}

      {webhook.deliveries.length > 0 ? (
        <div className="mt-2 border-t border-slate-50 pt-2">
          <div className="mb-1 text-[10px] font-medium uppercase text-slate-400">最近の配信</div>
          <div className="space-y-1">
            {webhook.deliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{d.event}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      d.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {d.statusCode ?? "ERR"}
                  </span>
                  <span className="text-slate-400">
                    {new Date(d.createdAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WebhookManager({ webhooks }: { webhooks: WebhookView[] }) {
  const [pending, start] = useTransition();

  return (
    <div>
      {webhooks.length > 0 ? (
        <div className="mb-4 space-y-2">
          {webhooks.map((w) => (
            <WebhookRow key={w.id} webhook={w} />
          ))}
        </div>
      ) : null}

      <form
        action={(fd) => start(() => createWebhook(fd))}
        className="space-y-3 rounded-lg border border-dashed border-slate-200 p-3"
      >
        <div className="text-xs font-medium text-slate-500">Webhookを追加</div>
        <input name="url" required className="input" placeholder="https://example.com/webhook" />
        <div>
          <div className="mb-1 text-xs text-slate-400">購読するイベント（未選択で全て）</div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e.value} className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="events" value={e.value} />
                {e.label}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "追加中…" : "追加（署名シークレットを自動生成）"}
        </button>
      </form>
    </div>
  );
}
