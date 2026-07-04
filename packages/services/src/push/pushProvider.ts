import type { ProviderHealth } from "../health/providerHealth";

/**
 * Push notification adapter contract (Expo Push first).
 *
 * Notification fan-out happens server-side: the API resolves recipients and
 * tokens, then hands batches of messages to this provider.
 */

export interface PushMessage {
  /** Push token (Expo push token format for the expo provider). */
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export interface PushSendReceipt {
  token: string;
  status: "ok" | "error";
  /** Provider ticket/receipt id when available. */
  ticketId?: string;
  /** e.g. "DeviceNotRegistered" — caller should deactivate the token. */
  errorCode?: string;
  errorMessage?: string;
}

export interface PushProvider {
  readonly name: "expo" | "mock";
  send(messages: PushMessage[]): Promise<PushSendReceipt[]>;
  healthCheck(): Promise<ProviderHealth>;
}
