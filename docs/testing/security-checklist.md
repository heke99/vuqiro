# Security Checklist / Review

Reviewed against the codebase at Batch 22. ✅ verified · ▶ before-launch task

## Authentication & authorization

- ✅ Supabase JWT verified server-side (`auth.getUser`) on every API call
- ✅ Suspended/banned accounts rejected on all mutating routes (`requireUser`)
- ✅ Admin routes require an active `admin_users` row; role-restricted routes
  (payouts, pricing, moderation decisions) enforce role lists
- ✅ Profile role/status self-escalation blocked by DB trigger
- ✅ Creators cannot access other creators' data (profile-scoped resolution)
- ▶ Enable Supabase MFA for admin accounts

## Row Level Security

- ✅ RLS enabled on all 39 tables (asserted in CI-runnable script)
- ✅ Clients: own-row write policies; world reads limited to
  ready+visible content and published catalogs
- ✅ Moderation/wallet/ledger/payout writes are service-role only
- ✅ Moderation fields protected from owner tampering by triggers
- ▶ Run the RLS test matrix against the production project before launch

## Secrets & configuration

- ✅ No secrets committed; `.env*` gitignored with `.env.example` contract
- ✅ Service-role key referenced only in `apps/api`
- ✅ Mobile builds receive only `EXPO_PUBLIC_*` values
- ✅ Webhook endpoints refuse all traffic when secrets are unset (fail closed)

## Payments integrity

- ✅ RevenueCat: secret-checked, event-id idempotent, coin credits keyed on
  event id (3 layers against double-credit)
- ✅ Stripe: HMAC signature + 5-minute replay window + event-id idempotency
  + transfer idempotency keys
- ✅ Wallet: row-locked atomic functions; balances cannot go negative
  (function + CHECK constraint); reversals floor at zero
- ✅ Locked-content playback URLs only from the server-side access check

## Input handling

- ✅ Zod validation on every request body/param; structured 400s
- ✅ Length limits on all text inputs (captions 500, comments 1000, etc.)
- ✅ Rate limits (see abuse-fraud-safety.md table)
- ✅ File upload constraints (format/size/duration) enforced server-side

## Logging & privacy

- ✅ API logs: method/path/status/duration/request-id only — no bodies,
  tokens or emails
- ✅ Audit logs are append-only (UPDATE/DELETE blocked by trigger)
- ✅ Push payload policy: no payout detail outside the authenticated inbox

## Known gaps (tracked)

- ▶ Signed playback tokens for gated video (Mux signed policy) — currently
  gated by URL non-disclosure; upgrade before large-scale launch
- ▶ Distributed rate-limit store (Redis) when running >1 API instance
- ▶ CSAM hash-matching vendor integration at scale
- ▶ Penetration test before public launch
