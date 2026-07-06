import type { ProviderHealth } from "../health/providerHealth";

/**
 * Email adapter contract (Resend first). Fan-out happens server-side: the
 * API resolves recipients and hands messages to this provider one batch at
 * a time.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body; providers may wrap it in a minimal template. */
  text: string;
  html?: string;
}

export interface EmailSendReceipt {
  to: string;
  status: "ok" | "error";
  /** Provider message id when available (stored for reconciliation). */
  messageId?: string;
  errorMessage?: string;
}

export interface EmailProvider {
  readonly name: "resend" | "mock";
  send(messages: EmailMessage[]): Promise<EmailSendReceipt[]>;
  healthCheck(): Promise<ProviderHealth>;
}
