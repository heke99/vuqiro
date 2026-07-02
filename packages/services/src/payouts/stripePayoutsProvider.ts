import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ConnectAccountStatus,
  ConnectAccountSummary,
  ConnectOnboardingLink,
  PayoutsProvider,
  TransferResult
} from "./payoutsProvider";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export type StripeProviderConfig = {
  secretKey: string;
  webhookSecret?: string;
};

type StripeAccount = {
  id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
  requirements?: { currently_due?: string[]; disabled_reason?: string | null };
};

function form(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

/**
 * Stripe Connect (Express) payouts provider using the REST API directly.
 * All transfer calls carry Stripe idempotency keys.
 */
export class StripePayoutsProvider implements PayoutsProvider {
  readonly name = "stripe" as const;

  constructor(private readonly config: StripeProviderConfig) {}

  private async request<T>(path: string, options: { method?: string; body?: string; idempotencyKey?: string } = {}): Promise<T> {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${this.config.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {})
      },
      body: options.body
    });
    const payload = (await response.json()) as T & { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(`Stripe ${path} failed: ${payload.error?.message ?? response.status}`);
    }
    return payload;
  }

  async createConnectedAccount(creatorId: string, email: string): Promise<{ accountId: string }> {
    const account = await this.request<{ id: string }>("/accounts", {
      method: "POST",
      body: form({
        type: "express",
        email,
        "capabilities[transfers][requested]": "true",
        "metadata[vuqiro_creator_id]": creatorId
      })
    });
    return { accountId: account.id };
  }

  async createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<ConnectOnboardingLink> {
    const link = await this.request<{ url: string; expires_at: number }>("/account_links", {
      method: "POST",
      body: form({
        account: accountId,
        type: "account_onboarding",
        return_url: returnUrl,
        refresh_url: refreshUrl
      })
    });
    return { url: link.url, expiresAt: new Date(link.expires_at * 1000).toISOString() };
  }

  async getAccountSummary(accountId: string): Promise<ConnectAccountSummary> {
    const account = await this.request<StripeAccount>(`/accounts/${accountId}`);
    let status: ConnectAccountStatus = "onboarding_started";
    if (account.payouts_enabled) {
      status = "verified";
    } else if (account.requirements?.disabled_reason) {
      status = "restricted";
    }
    return {
      accountId: account.id,
      status,
      payoutsEnabled: account.payouts_enabled,
      requirementsDue: account.requirements?.currently_due ?? []
    };
  }

  async createTransfer(
    accountId: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string
  ): Promise<TransferResult> {
    try {
      const transfer = await this.request<{ id: string }>("/transfers", {
        method: "POST",
        body: form({
          amount: String(amountCents),
          currency: currency.toLowerCase(),
          destination: accountId
        }),
        idempotencyKey
      });
      return { transferId: transfer.id, status: "pending" };
    } catch (error) {
      return {
        transferId: "",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Transfer failed"
      };
    }
  }

  /**
   * Verifies the Stripe-Signature header: `t=<ts>,v1=<hmac>` where the HMAC
   * is SHA256 over `<ts>.<rawBody>` with the webhook signing secret.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): { valid: boolean; reason?: string } {
    if (!this.config.webhookSecret) {
      return { valid: false, reason: "STRIPE_WEBHOOK_SECRET not configured" };
    }
    if (!signatureHeader) {
      return { valid: false, reason: "Missing stripe-signature header" };
    }
    const parts = new Map(
      signatureHeader.split(",").map((part) => {
        const [key, ...rest] = part.trim().split("=");
        return [key, rest.join("=")] as const;
      })
    );
    const timestamp = parts.get("t");
    const signature = parts.get("v1");
    if (!timestamp || !signature) {
      return { valid: false, reason: "Malformed stripe-signature header" };
    }
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
      return { valid: false, reason: "Stale webhook timestamp" };
    }
    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      return { valid: false, reason: "Signature mismatch" };
    }
    return { valid: true };
  }
}
