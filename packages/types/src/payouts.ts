import type { ID } from "./user";
import type { LedgerStatus } from "./payments";

export type PayoutAccountStatus =
  | "not_onboarded"
  | "onboarding_started"
  | "verified"
  | "restricted";

export type CreatorPayoutStatus =
  | "not_onboarded"
  | "onboarding_started"
  | "verified"
  | "restricted"
  | "pending"
  | "payable"
  | "held"
  | "processing"
  | "paid"
  | "failed";

export type PayoutHoldReason =
  | "moderation_case"
  | "fraud_review"
  | "refund_risk"
  | "creator_verification_missing"
  | "manual_admin_hold"
  | "legal_review";

export type CreatorPayoutAccount = {
  id: ID;
  creatorId: ID;
  provider: "stripe";
  providerAccountId?: string;
  status: PayoutAccountStatus;
  payoutsEnabled: boolean;
  createdAt: string;
};

export type RevenueLedgerEntry = {
  id: ID;
  creatorId: ID;
  source: "subscription" | "tip" | "unlock" | "boost" | "adjustment";
  grossAmount: number;
  platformFeeAmount: number;
  storeFeeAmount: number;
  netAmount: number;
  currency: string;
  status: LedgerStatus;
  relatedPurchaseId?: ID;
  createdAt: string;
};

export type CreatorPayout = {
  id: ID;
  creatorId: ID;
  amount: number;
  currency: string;
  status: CreatorPayoutStatus;
  providerTransferId?: string;
  failureReason?: string;
  batchId?: ID;
  createdAt: string;
  paidAt?: string;
};

export type PayoutHold = {
  id: ID;
  creatorId: ID;
  payoutId?: ID;
  reason: PayoutHoldReason;
  note?: string;
  placedBy: ID;
  releasedBy?: ID;
  releasedAt?: string;
  createdAt: string;
};
