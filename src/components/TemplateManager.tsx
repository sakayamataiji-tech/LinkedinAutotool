"use client";

import { useState, useTransition } from "react";
import { createTemplate, updateTemplate, deleteTemplate } from "@/lib/actions";

export interface TemplateView {
  id: string;
  name: string;
  category: string;
  subject: string | null;
  body: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  message: "メッセージ",
  inmail: "InMail",
  email: "メール",
};

function TemplateCard({ tpl }: { tpl: TemplateView }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <form
        action={(fd) =>
          start(async () => {
            await updateTemplate(tpl.id, fd);
            setEditing(false);
          })
        }
        className="card space-y-2 p-4"
      >
        <input name="name" defaultValue={tpl.name} className="input" placeholder="テンプレート名" />
        <div className="flex gap-2">
          <select name="category" defaultValue={tpl.category} className="input max-w-[140px]">
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input name="subject" defaultValue={tpl.subject ?? ""} className="input" placeholder="件名（任意）" />
        </div>
        <textarea name="body" defaultValue={tpl.body} className="input min-h-[90px]" />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn-primary">
            保存
          </button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            取消
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-sm font-medium text-slate-800">{tpl.name}</span>
          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            {CATEGORY_LABEL[tpl.category] ?? tpl.category}
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <button className="text-brand-600 hover:underline" onClick={() => setEditing(true)}>
            編集
          </button>
          <button
            className="text-red-500 hover:underline"
            disabled={pending}
            onClick={() => start(() => deleteTemplate(tpl.id))}
          >
            削除
          </button>
        </div>
      </div>
      {tpl.subject ? <div className="mt-1 text-xs text-slate-400">件名: {tpl.subject}</div> : null}
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{tpl.body}</p>
    </div>
  );
}

export function TemplateManager({ templates }: { templates: TemplateView[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
            テンプレートがありません。右のフォームから作成してください。
          </div>
        ) : (
          templates.map((t) => <TemplateCard key={t.id} tpl={t} />)
        )}
      </div>

      <div>
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">新規テンプレート</h2>
          <form action={(fd) => start(() => createTemplate(fd))} className="space-y-3">
            <div>
              <label className="label">名前</label>
              <input name="name" required className="input" placeholder="初回接続メッセージ" />
            </div>
            <div>
              <label className="label">種別</label>
              <select name="category" className="input">
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">件名（任意）</label>
              <input name="subject" className="input" />
            </div>
            <div>
              <label className="label">本文（{"{{firstName}}"} 等が使えます）</label>
              <textarea
                name="body"
                required
                className="input min-h-[110px]"
                placeholder="{{firstName}} さん、はじめまして。"
              />
            </div>
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "作成中…" : "作成する"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
