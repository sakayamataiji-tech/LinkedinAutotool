// Client-safe webhook event catalog (no server-only imports).

export const WEBHOOK_EVENTS = [
  { value: "connection.accepted", label: "接続リクエストが承認された" },
  { value: "message.sent", label: "メッセージを送信した" },
  { value: "message.replied", label: "リードから返信があった" },
  { value: "campaignLead.completed", label: "リードがシーケンスを完了した" },
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["value"] | "ping";
