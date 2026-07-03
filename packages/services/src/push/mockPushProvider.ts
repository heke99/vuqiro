import type { ProviderHealth } from "../health/providerHealth";
import type { PushMessage, PushProvider, PushSendReceipt } from "./pushProvider";

/**
 * In-memory push provider for development/test. Records every message so
 * tests can assert on delivery without hitting the Expo push service.
 */
export class MockPushProvider implements PushProvider {
  readonly name = "mock" as const;
  readonly sent: PushMessage[] = [];

  async send(messages: PushMessage[]): Promise<PushSendReceipt[]> {
    this.sent.push(...messages);
    return messages.map((message, index) => ({
      token: message.to,
      status: "ok" as const,
      ticketId: `mock-ticket-${this.sent.length - messages.length + index}`
    }));
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { provider: "push", status: "mock", message: "Mock push provider (development/test only)" };
  }

  reset(): void {
    this.sent.length = 0;
  }
}
