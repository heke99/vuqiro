import type { ProviderHealth } from "../health/providerHealth";
import type { EmailMessage, EmailProvider, EmailSendReceipt } from "./emailProvider";

/** Development/test email provider: records messages in memory. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock" as const;
  readonly sent: EmailMessage[] = [];

  async send(messages: EmailMessage[]): Promise<EmailSendReceipt[]> {
    this.sent.push(...messages);
    return messages.map((message, index) => ({
      to: message.to,
      status: "ok" as const,
      messageId: `mock_email_${Date.now()}_${index}`
    }));
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { provider: "email", status: "mock", message: "Mock email provider (set EMAIL_PROVIDER=resend + RESEND_API_KEY)" };
  }
}
