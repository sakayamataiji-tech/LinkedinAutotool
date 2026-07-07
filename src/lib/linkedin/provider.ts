import type { ActionType, ConditionType } from "@prisma/client";

/**
 * Pluggable LinkedIn provider interface.
 *
 * Every automated LinkedIn/email action goes through this interface. The MVP
 * ships a {@link MockLinkedInProvider}; a real implementation (browser
 * automation, official APIs, a 3rd-party unipile-style gateway, …) can be
 * dropped in later without touching the sequence engine or the UI.
 */

export interface LeadContext {
  leadId: string;
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  profileUrl: string | null;
  email: string | null;
  isConnected: boolean;
  isOpenProfile: boolean;
}

export interface ActionRequest {
  actionType: ActionType;
  lead: LeadContext;
  /** Rendered message body (templates already interpolated). */
  body?: string;
  subject?: string;
}

export interface ActionResult {
  ok: boolean;
  /** Human-readable detail for the activity log. */
  detail: string;
  /** Optional side effects the engine should persist onto the lead. */
  patch?: {
    isConnected?: boolean;
    email?: string;
    emailStatus?: string;
    isOpenProfile?: boolean;
  };
  /** For actions that create an inbound/outbound message (MESSAGE, INMAIL, SEND_EMAIL). */
  message?: { body: string; channel: string };
}

export interface ConditionRequest {
  conditionType: ConditionType;
  lead: LeadContext;
}

export interface LinkedInProvider {
  readonly name: string;
  execute(req: ActionRequest): Promise<ActionResult>;
  evaluate(req: ConditionRequest): Promise<boolean>;
}
