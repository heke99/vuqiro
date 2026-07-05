import type { ProviderHealth } from "../health/providerHealth";
import type { EmailMessage, EmailProvider, EmailSendReceipt } from "./emailProvider";

const RESEND_API = "https://api.resend.com";

export type ResendEmailConfig = {
  apiKey: string;
  /** Verified sender, e.g. "Vuqiro <no-reply@vuqiro.app>". */
  from: string;
};

/**
 * Resend HTTP API provider (https://resend.com/docs/api-reference).
 * Messages are sent individually; Resend's batch endpoint caps at 100 and
 * our notification batches are already small.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  constructor(private readonly config: ResendEmailConfig) {}

  async send(messages: EmailMessage[]): Promise<EmailSendReceipt[]> {
    const receipts: EmailSendReceipt[] = [];
    for (const message of messages) {
      try {
        const response = await fetch(`${RESEND_API}/emails`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            from: this.config.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html
          })
        });
        if (!response.ok) {
          const text = await response.text();
          receipts.push({
            to: message.to,
            status: "error",
            errorMessage: `Resend API ${response.status}: ${text.slice(0, 200)}`
          });
          continue;
        }
        const payload = (await response.json()) as { id?: string };
        receipts.push({ to: message.to, status: "ok", messageId: payload.id });
      } catch (error) {
        receipts.push({
          to: message.to,
          status: "error",
          errorMessage: error instanceof Error ? error.message : "send failed"
        });
      }
    }
    return receipts;
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const response = await fetch(`${RESEND_API}/domains`, {
        headers: { authorization: `Bearer ${this.config.apiKey}` }
      });
      if (response.status === 401) {
        return { provider: "email", status: "down", message: "Resend API key rejected" };
      }
      return response.ok
        ? { provider: "email", status: "ok", message: "Resend API reachable" }
        : { provider: "email", status: "degraded", message: `Resend API returned ${response.status}` };
    } catch (error) {
      return {
        provider: "email",
        status: "down",
        message: error instanceof Error ? error.message : "Resend API unreachable"
      };
    }
  }
}
