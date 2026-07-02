# Batch 3 — Shared packages and mock data

Status: complete

## What changed

- **`packages/types` restructured to the full domain model**, one file per
  domain exactly as specified: `user`, `creator`, `video`, `comments`,
  `payments`, `wallet`, `subscriptions`, `moderation`, `notifications`,
  `admin`, `analytics`, `legal`, `payouts`, `audit` (+ `index`). Removed the
  old `core.ts`/`social.ts`.
- All spec enums are present verbatim: `BillingPlatform`, `PackageType`,
  `PackageStatus`, `StoreProductStatus`, `PurchaseStatus`,
  `CreatorMembershipStatus`, `LedgerStatus`, `ModerationStatus`,
  `ReportReason`, `ModerationAction` (extended with `age_restrict` per the
  Batch 12 action list), plus `VideoStatus`, `PayoutHoldReason`,
  `CreatorPayoutStatus`, `AnalyticsEventName`, `AuditLogAction`, etc.
- New entity types: `User`, `AccountDeletionRequest`, `VideoAsset`,
  `Purchase`, `PurchaseEvent`, `CreatorMembership`, `ContentEntitlement`,
  `Wallet`, `Report`, `Block`, `ModerationDecision`,
  `NotificationPreferences`, `CreatorPayoutAccount`, `RevenueLedgerEntry`,
  `CreatorPayout`, `PayoutHold`, `LegalDocument`, `LegalAcceptance`,
  `AnalyticsEvent`, `CreatorAnalyticsSummary`, `AdminUser`, `FeatureFlag`,
  `AdminDashboardMetrics`, `FraudSignal`, `ReadinessItem`, `AuditLogEntry`.
- **`packages/mock-data` split per domain and expanded to spec minimums:**
  - 10 creators, 25 videos, 50 comments (with replies), 15 notifications,
    20 wallet transactions, 20 reports (linked to 8 moderation cases),
    20 audit logs, 10 payouts + 10 payout accounts + holds + ledger entries.
  - Full monetization packages (3 subscription tiers, 4 coin packs, 3 boost
    packs), 10 price versions, 17 store product mappings across iOS/Android
    with the exact `com.diversasolutions.vuqiro.*` product IDs.
  - Full admin mock: superadmin identity, 15-field dashboard metrics, 12
    users, feature flags, fraud signals, app-store readiness items, legal
    documents + acceptances, creator analytics summaries.
- **Tests:** `mockData.test.ts` enforces the spec minimum counts and
  referential integrity (videos→creators, comments→videos, replies→parents,
  versions→packages, products→versions, ledger/payouts→creators, unique ids).

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # all pass (15 mock-data tests)
```

## Acceptance criteria

- [x] mobile and admin use shared types (all imports via `@vuqiro/types`)
- [x] no duplicated inconsistent models (single source in packages/types)
- [x] mock data exports cleanly (index re-exports per-domain files)
- [x] typecheck passes
