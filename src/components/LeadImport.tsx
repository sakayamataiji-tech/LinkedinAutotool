"use client";

import { useActionState } from "react";
import {
  importCsvAction,
  importProfileUrlsAction,
  importMockSourceAction,
  type ImportState,
} from "@/lib/leads/import-actions";

interface Campaign {
  id: string;
  name: string;
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "LINKEDIN_SEARCH", label: "LinkedIn 検索結果" },
  { value: "SALES_NAVIGATOR", label: "Sales Navigator 検索結果" },
  { value: "RECRUITER", label: "Recruiter 検索結果" },
  { value: "EVENT_ATTENDEES", label: "イベント参加者" },
  { value: "POST_LIKERS", label: "投稿への「いいね」ユーザー" },
  { value: "POST_COMMENTERS", label: "投稿へのコメントユーザー" },
  { value: "FIRST_CONNECTIONS", label: "1次接続ユーザー" },
];

function ResultBanner({ state }: { state: ImportState }) {
  if (state.error) {
    return <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>;
  }
  if (state.ok && state.summary) {
    const s = state.summary;
    return (
      <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        取り込み完了: <b>{s.imported}</b> 件追加
        {s.skippedDuplicate > 0 ? ` · 重複スキップ ${s.skippedDuplicate}` : ""}
        {s.skippedInvalid > 0 ? ` · 無効スキップ ${s.skippedInvalid}` : ""}
        （対象 {s.total} 件）
      </div>
    );
  }
  return null;
}

/** Shared tags + campaign fields used by every import form. */
function Options({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="label">タグ（カンマ区切り・任意）</label>
        <input name="tags" className="input" placeholder="SaaS, ホット" />
      </div>
      <div>
        <label className="label">キャンペーンに登録（任意）</label>
        <select name="campaignId" className="input">
          <option value="">登録しない</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function CsvImport({ campaigns }: { campaigns: Campaign[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importCsvAction, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">CSVファイル</label>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        <p className="mt-1 text-xs text-slate-400">
          対応列: name / firstName / lastName / company / jobTitle / location / email / profileUrl。
          <a href="/api/leads/template" className="ml-1 text-brand-600 hover:underline">
            テンプレートをダウンロード
          </a>
        </p>
      </div>
      <Options campaigns={campaigns} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "取り込み中…" : "CSVを取り込む"}
      </button>
      <ResultBanner state={state} />
    </form>
  );
}

export function UrlImport({ campaigns }: { campaigns: Campaign[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importProfileUrlsAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">プロフィールURL（1行に1件）</label>
        <textarea
          name="urls"
          required
          className="input min-h-[120px]"
          placeholder={"https://www.linkedin.com/in/john-doe\nhttps://www.linkedin.com/in/jane-smith"}
        />
      </div>
      <Options campaigns={campaigns} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "取り込み中…" : "URLから取り込む"}
      </button>
      <ResultBanner state={state} />
    </form>
  );
}

export function SourceImport({ campaigns }: { campaigns: Campaign[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importMockSourceAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">ソース</label>
          <select name="source" className="input">
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">取り込み件数</label>
          <input name="count" type="number" min={1} max={50} defaultValue={10} className="input" />
        </div>
      </div>
      <Options campaigns={campaigns} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "取り込み中…" : "検索結果から取り込む（デモ）"}
      </button>
      <p className="text-xs text-slate-400">
        ※ 本番では LinkedIn / Sales Navigator / Recruiter の検索結果や参加者リストから取得します。
        MVPではデモ用のリードを生成します。
      </p>
      <ResultBanner state={state} />
    </form>
  );
}
