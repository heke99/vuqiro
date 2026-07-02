import type { CreatorPayout, CreatorPayoutAccount, PayoutHold, RevenueLedgerEntry } from "@vuqiro/types";

export const mockPayoutAccounts: CreatorPayoutAccount[] = [
  { id: "acct_001", creatorId: "creator_001", provider: "stripe", providerAccountId: "acct_mock_maya", status: "verified", payoutsEnabled: true, createdAt: "2025-10-01T00:00:00Z" },
  { id: "acct_002", creatorId: "creator_002", provider: "stripe", providerAccountId: "acct_mock_riven", status: "verified", payoutsEnabled: true, createdAt: "2025-11-01T00:00:00Z" },
  { id: "acct_003", creatorId: "creator_003", provider: "stripe", providerAccountId: "acct_mock_noor", status: "onboarding_started", payoutsEnabled: false, createdAt: "2026-01-15T00:00:00Z" },
  { id: "acct_004", creatorId: "creator_004", provider: "stripe", providerAccountId: "acct_mock_sola", status: "verified", payoutsEnabled: true, createdAt: "2025-09-01T00:00:00Z" },
  { id: "acct_005", creatorId: "creator_005", provider: "stripe", providerAccountId: "acct_mock_kai", status: "verified", payoutsEnabled: true, createdAt: "2025-10-20T00:00:00Z" },
  { id: "acct_006", creatorId: "creator_006", provider: "stripe", providerAccountId: "acct_mock_lumen", status: "restricted", payoutsEnabled: false, createdAt: "2026-01-05T00:00:00Z" },
  { id: "acct_007", creatorId: "creator_007", provider: "stripe", providerAccountId: "acct_mock_vera", status: "verified", payoutsEnabled: true, createdAt: "2025-11-10T00:00:00Z" },
  { id: "acct_008", creatorId: "creator_008", provider: "stripe", providerAccountId: "acct_mock_dune", status: "verified", payoutsEnabled: true, createdAt: "2025-09-15T00:00:00Z" },
  { id: "acct_009", creatorId: "creator_009", provider: "stripe", status: "not_onboarded", payoutsEnabled: false, createdAt: "2026-02-01T00:00:00Z" },
  { id: "acct_010", creatorId: "creator_010", provider: "stripe", status: "not_onboarded", payoutsEnabled: false, createdAt: "2026-03-01T00:00:00Z" }
];

export const mockPayouts: CreatorPayout[] = [
  { id: "payout_001", creatorId: "creator_001", amount: 1272.0, currency: "USD", status: "paid", providerTransferId: "tr_mock_001", batchId: "batch_2026_06", createdAt: "2026-06-01T00:00:00Z", paidAt: "2026-06-03T00:00:00Z" },
  { id: "payout_002", creatorId: "creator_004", amount: 2184.5, currency: "USD", status: "paid", providerTransferId: "tr_mock_002", batchId: "batch_2026_06", createdAt: "2026-06-01T00:00:00Z", paidAt: "2026-06-03T00:00:00Z" },
  { id: "payout_003", creatorId: "creator_005", amount: 892.4, currency: "USD", status: "paid", providerTransferId: "tr_mock_003", batchId: "batch_2026_06", createdAt: "2026-06-01T00:00:00Z", paidAt: "2026-06-04T00:00:00Z" },
  { id: "payout_004", creatorId: "creator_007", amount: 668.1, currency: "USD", status: "processing", providerTransferId: "tr_mock_004", batchId: "batch_2026_07", createdAt: "2026-07-01T00:00:00Z" },
  { id: "payout_005", creatorId: "creator_001", amount: 1401.8, currency: "USD", status: "processing", providerTransferId: "tr_mock_005", batchId: "batch_2026_07", createdAt: "2026-07-01T00:00:00Z" },
  { id: "payout_006", creatorId: "creator_008", amount: 1522.6, currency: "USD", status: "held", batchId: "batch_2026_07", createdAt: "2026-07-01T00:00:00Z" },
  { id: "payout_007", creatorId: "creator_002", amount: 534.9, currency: "USD", status: "payable", createdAt: "2026-07-01T00:00:00Z" },
  { id: "payout_008", creatorId: "creator_006", amount: 218.7, currency: "USD", status: "held", createdAt: "2026-07-01T00:00:00Z" },
  { id: "payout_009", creatorId: "creator_004", amount: 2410.3, currency: "USD", status: "pending", createdAt: "2026-07-01T00:00:00Z" },
  { id: "payout_010", creatorId: "creator_005", amount: 41.2, currency: "USD", status: "failed", failureReason: "Bank account closed", batchId: "batch_2026_06", createdAt: "2026-06-01T00:00:00Z" }
];

export const mockPayoutHolds: PayoutHold[] = [
  { id: "hold_001", creatorId: "creator_008", payoutId: "payout_006", reason: "moderation_case", note: "Scam reports under review (mod_005).", placedBy: "admin_001", createdAt: "2026-06-29T10:00:00Z" },
  { id: "hold_002", creatorId: "creator_006", payoutId: "payout_008", reason: "creator_verification_missing", note: "Stripe account restricted; identity docs requested.", placedBy: "admin_001", createdAt: "2026-06-30T09:00:00Z" }
];

export const mockLedgerEntries: RevenueLedgerEntry[] = [
  { id: "ledger_001", creatorId: "creator_001", source: "subscription", grossAmount: 5.99, platformFeeAmount: 1.2, storeFeeAmount: 0.9, netAmount: 3.89, currency: "USD", status: "payable", createdAt: "2026-07-01T08:00:00Z" },
  { id: "ledger_002", creatorId: "creator_001", source: "tip", grossAmount: 1.0, platformFeeAmount: 0.2, storeFeeAmount: 0.15, netAmount: 0.65, currency: "USD", status: "payable", createdAt: "2026-07-01T10:00:00Z" },
  { id: "ledger_003", creatorId: "creator_002", source: "unlock", grossAmount: 1.0, platformFeeAmount: 0.2, storeFeeAmount: 0.15, netAmount: 0.65, currency: "USD", status: "pending", createdAt: "2026-07-02T09:00:00Z" },
  { id: "ledger_004", creatorId: "creator_004", source: "subscription", grossAmount: 9.99, platformFeeAmount: 2.0, storeFeeAmount: 1.5, netAmount: 6.49, currency: "USD", status: "payable", createdAt: "2026-07-01T12:00:00Z" },
  { id: "ledger_005", creatorId: "creator_008", source: "subscription", grossAmount: 2.99, platformFeeAmount: 0.6, storeFeeAmount: 0.45, netAmount: 1.94, currency: "USD", status: "held", createdAt: "2026-07-01T14:00:00Z" },
  { id: "ledger_006", creatorId: "creator_005", source: "tip", grossAmount: 0.75, platformFeeAmount: 0.15, storeFeeAmount: 0.11, netAmount: 0.49, currency: "USD", status: "paid", createdAt: "2026-06-24T19:45:00Z" },
  { id: "ledger_007", creatorId: "creator_007", source: "subscription", grossAmount: 9.99, platformFeeAmount: 2.0, storeFeeAmount: 1.5, netAmount: 6.49, currency: "USD", status: "refunded", createdAt: "2026-06-20T08:00:00Z" }
];
