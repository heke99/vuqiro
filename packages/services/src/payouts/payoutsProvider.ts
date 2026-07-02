/**
 * Creator payout adapter contract (Stripe Connect first).
 * All payout mutations are server-side and audit-logged.
 */

export type ConnectAccountStatus =
  | "not_onboarded"
  | "onboarding_started"
  | "verified"
  | "restricted";

export interface ConnectOnboardingLink {
  url: string;
  expiresAt: string;
}

export interface ConnectAccountSummary {
  accountId: string;
  status: ConnectAccountStatus;
  payoutsEnabled: boolean;
  requirementsDue: string[];
}

export interface TransferResult {
  transferId: string;
  status: "pending" | "paid" | "failed";
  errorMessage?: string;
}

export interface PayoutsProvider {
  readonly name: "stripe" | "mock";
  createConnectedAccount(creatorId: string, email: string): Promise<{ accountId: string }>;
  createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<ConnectOnboardingLink>;
  getAccountSummary(accountId: string): Promise<ConnectAccountSummary>;
  createTransfer(accountId: string, amountCents: number, currency: string, idempotencyKey: string): Promise<TransferResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): { valid: boolean; reason?: string };
}
