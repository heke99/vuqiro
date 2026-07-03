import type { ProviderHealth } from "../health/providerHealth";
import type { PushMessage, PushProvider, PushSendReceipt } from "./pushProvider";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export type ExpoPushConfig = {
  /** Optional Expo access token (required for enhanced security orgs). */
  accessToken?: string;
};

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

/**
 * Expo Push HTTP API provider. Contract follows the public Expo push
 * documentation (https://docs.expo.dev/push-notifications/sending-notifications/).
 */
export class ExpoPushProvider implements PushProvider {
  readonly name = "expo" as const;

  constructor(private readonly config: ExpoPushConfig = {}) {}

  async send(messages: PushMessage[]): Promise<PushSendReceipt[]> {
    const receipts: PushSendReceipt[] = [];
    for (let start = 0; start < messages.length; start += BATCH_SIZE) {
      const batch = messages.slice(start, start + BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(this.config.accessToken ? { authorization: `Bearer ${this.config.accessToken}` } : {})
        },
        body: JSON.stringify(
          batch.map((message) => ({
            to: message.to,
            title: message.title,
            body: message.body,
            data: message.data,
            sound: message.sound === undefined ? "default" : message.sound,
            badge: message.badge
          }))
        )
      });
      if (!response.ok) {
        const text = await response.text();
        receipts.push(
          ...batch.map((message) => ({
            token: message.to,
            status: "error" as const,
            errorMessage: `Expo push API ${response.status}: ${text.slice(0, 200)}`
          }))
        );
        continue;
      }
      const payload = (await response.json()) as { data?: ExpoPushTicket[] };
      const tickets = payload.data ?? [];
      batch.forEach((message, index) => {
        const ticket = tickets[index];
        if (!ticket) {
          receipts.push({ token: message.to, status: "error", errorMessage: "Missing ticket" });
        } else if (ticket.status === "ok") {
          receipts.push({ token: message.to, status: "ok", ticketId: ticket.id });
        } else {
          receipts.push({
            token: message.to,
            status: "error",
            errorCode: ticket.details?.error,
            errorMessage: ticket.message
          });
        }
      });
    }
    return receipts;
  }

  async healthCheck(): Promise<ProviderHealth> {
    // The Expo push API has no unauthenticated ping; verify DNS/reachability
    // with a HEAD-style empty POST and treat any HTTP response as reachable.
    try {
      const response = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([])
      });
      return response.status < 500
        ? { provider: "push", status: "ok", message: "Expo push API reachable" }
        : { provider: "push", status: "degraded", message: `Expo push API returned ${response.status}` };
    } catch (error) {
      return {
        provider: "push",
        status: "down",
        message: error instanceof Error ? error.message : "Expo push API unreachable"
      };
    }
  }
}
