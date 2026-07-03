import type { ProviderHealth } from "../health/providerHealth";
import type {
  ConnectAccountSummary,
  ConnectOnboardingLink,
  PayoutsProvider,
  TransferResult
} from "./payoutsProvider";

/**
 * In-memory payouts provider for credential-free development. Accounts are
 * "verified" immediately after onboarding starts so the full payout flow can
 * be exercised locally.
 */
export class MockPayoutsProvider implements PayoutsProvider {
  readonly name = "mock" as const;
  private accounts = new Map<string, ConnectAccountSummary>();
  private transfersByKey = new Map<string, TransferResult>();

  async createConnectedAccount(creatorId: string, _email: string): Promise<{ accountId: string }> {
    const accountId = `acct_mock_${creatorId.slice(0, 8)}_${this.accounts.size + 1}`;
    this.accounts.set(accountId, {
      accountId,
      status: "onboarding_started",
      payoutsEnabled: false,
      requirementsDue: ["external_account"]
    });
    return { accountId };
  }

  async createOnboardingLink(accountId: string, returnUrl: string, _refreshUrl: string): Promise<ConnectOnboardingLink> {
    // Mock onboarding "completes" instantly.
    const account = this.accounts.get(accountId);
    if (account) {
      this.accounts.set(accountId, { ...account, status: "verified", payoutsEnabled: true, requirementsDue: [] });
    }
    return {
      url: `https://mock.vuqiro.local/connect/onboarding/${accountId}?return=${encodeURIComponent(returnUrl)}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }

  async getAccountSummary(accountId: string): Promise<ConnectAccountSummary> {
    return (
      this.accounts.get(accountId) ?? {
        accountId,
        status: "verified",
        payoutsEnabled: true,
        requirementsDue: []
      }
    );
  }

  async createTransfer(
    accountId: string,
    amountCents: number,
    _currency: string,
    idempotencyKey: string
  ): Promise<TransferResult> {
    const existing = this.transfersByKey.get(idempotencyKey);
    if (existing) return existing;
    const result: TransferResult = {
      transferId: `tr_mock_${idempotencyKey.slice(0, 12)}_${amountCents}`,
      status: "paid"
    };
    this.transfersByKey.set(idempotencyKey, result);
    return result;
  }

  verifyWebhookSignature(_rawBody: string, _signatureHeader: string | undefined): { valid: boolean; reason?: string } {
    return { valid: true };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { provider: "payouts", status: "mock", message: "Mock payouts provider (development/test only)" };
  }
}
