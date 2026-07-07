"use client";

import { useState, useTransition } from "react";
import { replyInInbox, toggleConversationFlag } from "@/lib/actions";

export function FlagButtons({
  conversationId,
  important,
  archived,
}: {
  conversationId: string;
  important: boolean;
  archived: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        className="btn-ghost"
        disabled={pending}
        onClick={() => start(() => toggleConversationFlag(conversationId, "important", !important))}
      >
        {important ? "★ 重要" : "☆ 重要にする"}
      </button>
      <button
        className="btn-ghost"
        disabled={pending}
        onClick={() => start(() => toggleConversationFlag(conversationId, "archived", !archived))}
      >
        {archived ? "アーカイブ解除" : "アーカイブ"}
      </button>
    </div>
  );
}

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex items-end gap-2 border-t border-slate-100 p-4">
      <textarea
        className="input min-h-[44px] resize-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="返信を入力…"
      />
      <button
        className="btn-primary"
        disabled={pending || !value.trim()}
        onClick={() =>
          start(async () => {
            await replyInInbox(conversationId, value);
            setValue("");
          })
        }
      >
        送信
      </button>
    </div>
  );
}
