# Batch 13 — RevenueCat payments

Status: complete (sandbox testing requires owner store/RevenueCat accounts)

## What changed

### Mobile

- **`react-native-purchases` installed** and wrapped in
  `RevenueCatPaymentsProvider` behind the shared `PaymentsProvider`
  interface. The native module is loaded **lazily** — inside Expo Go (or
  without `EXPO_PUBLIC_REVENUECAT_*` keys) the app silently stays on
  `MockPaymentsProvider`; it can never crash on a missing native module.
- Provider selection (`getPaymentsProvider`): RevenueCat when keys + native
  module exist, mock otherwise.
- **SDK configuration**: on sign-in the provider is configured with the
  Supabase auth user id as the RevenueCat `app_user_id` — the exact id the
  webhook resolves back to a profile.
- **Paywalls now use offerings**: the subscribe modal and coins modal fetch
  live offerings (store-provided localized prices in real mode; the
  reference catalog in demo mode) and run purchases through the provider.
  Subscription purchases set the `intended_creator` subscriber attribute so
  the webhook can attribute the membership to the right creator.
- **Restore purchases** added to Settings (spec + App Store requirement).

### Backend

- **Full webhook processing** (`lib/revenuecatProcessor.ts`), driven by the
  stored-event pipeline from Batch 8:
  - `INITIAL_PURCHASE` / `RENEWAL` / `NON_RENEWING_PURCHASE` → purchase
    upsert (unique on store transaction) + coin credit or membership
    activation.
  - `CANCELLATION` / `EXPIRATION` → membership ended.
  - `BILLING_ISSUE` → membership `grace_period`.
  - `REFUND` / `REVOKED` → purchase marked, coins reversed (floor at zero),
    memberships expired and **membership-derived entitlements revoked**.
- **Three layers of idempotency**: unique webhook `event_id`, unique
  `(platform, store_transaction_id)` purchase upsert, and coin transactions
  keyed `rc:<event_id>` — a replayed webhook can never double-credit.
- **Server-side locked-content check**: `GET /videos/:id/access` — the ONLY
  place gated playback URLs are returned, after verifying public/owner/
  follower/coin-entitlement/membership-tier access. 403 with no URL
  otherwise. Client entitlement state is never trusted.

## Product IDs (as configured in mocks/seed/store mappings)

- Subscriptions: `com.diversasolutions.vuqiro.creator.{support,plus,premium}.monthly`
- Coins: `com.diversasolutions.vuqiro.coins.{100,500,1200,5000}`
- Boosts: `com.diversasolutions.vuqiro.boost.{small,growth,launch}`

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 76 api tests
```

New tests: webhook credential enforcement (missing/wrong/plain/bearer),
malformed-event rejection, access-check auth, public video URL grant, locked
video denial without URL leakage.

## Acceptance criteria vs. external dependencies

- [x] webhook creates purchase event (idempotent envelope + processing)
- [x] entitlement sync works (webhook → memberships/coins/entitlements)
- [x] locked content unlock works (server access check + coin unlock flow)
- [x] refunds/revocations remove access (reversals + entitlement revocation)
- [x] duplicate webhook does not double-credit (3 idempotency layers)
- [x] restore purchases exists in-app
- [ ] sandbox subscription/coin purchase — **requires** Apple/Google
      developer accounts, store products, RevenueCat project + keys, and an
      EAS development build (documented in docs/app-store/ + Batch 21)
