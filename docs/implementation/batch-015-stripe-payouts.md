# Batch 15 — Stripe Connect creator payouts

Status: complete (live payouts require the owner's Stripe account)

## What changed

- **`StripePayoutsProvider`** (`packages/services`): Express connected-account
  creation (creator id in metadata), onboarding links, account summary with
  status mapping (verified/restricted/onboarding), transfers with **Stripe
  idempotency keys**, and webhook signature verification (HMAC over
  `t.rawBody`, constant-time compare, 5-minute replay window, fail-closed
  without a secret). `MockPayoutsProvider` mirrors the interface with
  instant-verifying accounts and idempotent transfers for local dev;
  selection is env-driven (`STRIPE_SECRET_KEY`).
- **Creator endpoints**:
  - `POST /payouts/onboarding` — creates/reuses the connected account, stores
    the account id in `creator_payout_accounts`, returns the onboarding URL.
  - `GET /payouts/me` — payout dashboard: live-synced Stripe account status,
    payable/pending/held balances from the revenue ledger, payout history,
    active holds with reasons, and the $25 minimum threshold.
- **Payout batches** (`POST /admin/payouts/batch`, superadmin/finance only):
  aggregates payable ledger per creator; **skips** creators under the
  minimum, with an active hold, or without a verified payouts-enabled
  account; creates payout rows with batch-scoped idempotency keys
  (`batch:<id>:<creator>` — a re-run after partial failure never
  double-pays); executes transfers; marks ledger entries `paid` and links
  them to the payout; records per-creator failures with reasons; **fully
  audit-logged** with created/paid/failed/skipped counts. Duplicate batch ids
  are rejected.
- **Stripe webhook completed**: signature-verified, idempotent on the Stripe
  event id (`purchase_events` unique constraint), processing
  `account.updated` (status/requirements sync) and `transfer.reversed`
  (payout → failed for review).
- Hold/release endpoints (Batch 8/12) complete the superadmin control loop.

## Payout statuses & hold reasons

Statuses: `not_onboarded → onboarding_started → verified/restricted` (account),
`pending → payable → processing → paid | failed | held` (payout).
Hold reasons: moderation_case, fraud_review, refund_risk,
creator_verification_missing, manual_admin_hold, legal_review.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 98 api tests
```

12 new tests: onboarding auth + link creation, dashboard shape, batch RBAC +
validation + audit logging, Stripe signature accept/tamper/stale/no-secret,
webhook endpoint unsigned-rejection and signed-acceptance.

## Acceptance criteria

- [x] creator can start onboarding
- [x] admin sees Stripe status (creators page + live sync)
- [x] ledger creates payable balance
- [x] superadmin can hold/release payout (audit-logged)
- [x] payout action audit logged
- [x] failed payout shown clearly (dashboard + admin payouts table)
- [x] webhook idempotency works (unique event id + transfer idempotency keys)

## External setup required

Stripe account with Connect enabled: `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` (endpoint `POST {API_BASE_URL}/stripe/webhook`,
events: `account.updated`, `transfer.reversed`), `STRIPE_CONNECT_CLIENT_ID`.
