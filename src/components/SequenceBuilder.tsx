"use client";

import { useState, useTransition } from "react";
import { addSequenceNode, deleteSequenceNode } from "@/lib/actions";

export const ACTION_LABELS: Record<string, string> = {
  CONNECT_REQUEST: "接続リクエスト送信",
  MESSAGE: "メッセージ送信",
  INMAIL: "InMail送信",
  VIEW_PROFILE: "プロフィール閲覧",
  ENDORSE_SKILL: "スキル推薦",
  FOLLOW: "フォロー",
  LIKE_POST: "投稿に「いいね」",
  FIND_EMAIL: "メールアドレス検索",
  SEND_EMAIL: "メール送信",
  WITHDRAW_REQUEST: "接続リクエスト取り消し",
};

export const CONDITION_LABELS: Record<string, string> = {
  IS_CONNECTED: "接続済みか",
  MESSAGE_SEEN: "メッセージを閲覧したか",
  HAS_EMAIL: "メール取得済みか",
  IS_OPEN_PROFILE: "オープンプロフィールか",
};

const MESSAGE_ACTIONS = new Set(["MESSAGE", "INMAIL", "SEND_EMAIL"]);

export function AddNodeForm({ sequenceId }: { sequenceId: string }) {
  const [kind, setKind] = useState<"ACTION" | "DELAY" | "CONDITION">("ACTION");
  const [actionType, setActionType] = useState("CONNECT_REQUEST");
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => start(() => addSequenceNode(fd))}
      className="space-y-3"
    >
      <input type="hidden" name="sequenceId" value={sequenceId} />
      <div>
        <label className="label">ノード種別</label>
        <select
          name="kind"
          className="input"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="ACTION">アクション</option>
          <option value="DELAY">待機（遅延）</option>
          <option value="CONDITION">条件分岐</option>
        </select>
      </div>

      {kind === "ACTION" ? (
        <>
          <div>
            <label className="label">アクション</label>
            <select
              name="actionType"
              className="input"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            >
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {MESSAGE_ACTIONS.has(actionType) ? (
            <>
              {actionType !== "MESSAGE" ? (
                <div>
                  <label className="label">件名</label>
                  <input name="messageSubject" className="input" />
                </div>
              ) : null}
              <div>
                <label className="label">本文（{"{{firstName}}"} 等が使えます）</label>
                <textarea
                  name="messageBody"
                  className="input min-h-[80px]"
                  placeholder="はじめまして {{firstName}} さん、"
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {kind === "DELAY" ? (
        <div>
          <label className="label">待機時間（分）</label>
          <input name="delayMinutes" type="number" min={1} defaultValue={1440} className="input" />
        </div>
      ) : null}

      {kind === "CONDITION" ? (
        <div>
          <label className="label">条件</label>
          <select name="conditionType" className="input">
            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "追加中…" : "ステップを追加"}
      </button>
    </form>
  );
}

export function DeleteNodeButton({ nodeId, sequenceId }: { nodeId: string; sequenceId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="text-xs text-slate-300 hover:text-red-500"
      disabled={pending}
      onClick={() => start(() => deleteSequenceNode(nodeId, sequenceId))}
      aria-label="削除"
    >
      ✕
    </button>
  );
}
