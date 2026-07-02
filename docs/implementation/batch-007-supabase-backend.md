# Batch 7 — Supabase backend, auth and database

Status: complete

## Schema

Four migrations replace the old draft (`supabase/migrations/`):

1. **`20260702100000_core.sql`** — extensions, `set_updated_at` helper,
   `profiles` (FK to `auth.users`, handle validation, roles, statuses),
   `admin_users` (separate admin identity + roles), helper functions
   (`current_profile_id`, `is_admin`, `is_superadmin`, `is_active_user`),
   **profile-creation trigger** on `auth.users` (handle collision-safe),
   `creators`, `creator_profiles`, `feature_flags`,
   `account_deletion_requests`.
2. **`20260702100100_content.sql`** — `videos` (full status/moderation/
   visibility state machines with check constraints, counters, GIN hashtag
   index, feed index), `video_assets` (provider objects), `video_events`,
   `follows`, `likes`, `saves`, `blocks`, `comments` (+ reply threading),
   `comment_likes`.
3. **`20260702100200_moderation.sql`** — `moderation_cases`, `reports`,
   `moderation_actions`, `notifications`, `notification_preferences`,
   `legal_documents` (+versions), `legal_acceptances`, **append-only
   `audit_logs`** (update/delete blocked by trigger).
4. **`20260702100300_monetization.sql`** — package catalog + versions +
   store products, `purchases` (unique store transaction),
   `purchase_events` (unique provider event id — webhook idempotency),
   `revenuecat_webhook_events`, `wallets` (non-negative balances),
   `coin_transactions` (idempotency keys), `creator_memberships`,
   `creator_membership_entitlements`, `creator_revenue_ledger`,
   `creator_payout_accounts`, `creator_payouts` (idempotency + transfer
   uniqueness), `payout_holds`.

All 37 tables have UUID PKs, timestamps, `updated_at` triggers where mutable,
FK indexes, and check constraints.

## RLS (`20260702100400_rls.sql`)

- RLS enabled on **every** table (verified by the validation script).
- Users: own-row updates on profiles with a trigger blocking role/status
  self-escalation; own social rows (follows/likes/saves/blocks/comments);
  own wallet/purchases/memberships/entitlements/notifications/acceptances.
- Videos: world can read only `ready` + visible-ish moderation states;
  owners manage their own but a trigger prevents them touching moderation
  fields or illegal status transitions; banned/suspended users cannot insert
  (all inserts require `is_active_user()`).
- Admin console reads via `is_admin()`; payout/ledger/moderation writes are
  **service-role only** (no client policies — the API owns them).
- Audit logs: admin read, append-only.

## Validation

Docker is unavailable in this environment, so `supabase db reset` could not
run. Instead `scripts/validate-migrations.sh` was added: it provisions a local
PostgreSQL 16 database, applies a minimal `auth` schema shim (`auth.users`,
`auth.uid()`), runs every migration + seed in order, and asserts every public
table has RLS enabled. Result: **37 tables, all RLS-enabled, clean apply**.
`supabase/config.toml` is included for CLI-based local development.

## Seed

`supabase/seed/seed.sql` mirrors the mock data: 7 auth users (5 creators, a
viewer test account, a superadmin), creators + storefronts, 5 ready videos
(2 gated), the full package/version/store-product catalog with real
`com.diversasolutions.vuqiro.*` IDs, viewer wallet, feature flags, and
published legal documents.

## App integration

- **Mobile**: `src/services/supabase/client.ts` (AsyncStorage-backed session,
  null-safe when unconfigured), `AuthProvider` with real
  email/password + magic-link sign-in, sign-up (handle metadata → profile
  trigger), session restore, profile loading, sign-out, and account-deletion
  request/cancel writing to `account_deletion_requests`. `index.tsx` routes by
  session. All screens keep working in mock mode with a visible notice.
- **Admin**: `@supabase/ssr` server client + `getAdminIdentity()` —
  when Supabase env is configured the console requires a signed-in user with
  an active `admin_users` row (RLS-checked) and shows a real sign-in gate;
  without env it runs in clearly-labelled mock mode.

## Acceptance criteria

- [x] migrations run cleanly (validated locally against Postgres 16)
- [x] RLS does not break normal user flows (read/write policies mirror app usage)
- [x] mobile can sign up/login (real when env present, mock fallback otherwise)
- [x] profile loads from backend (AuthProvider profile query)
- [x] admin access is role-protected (admin_users + is_admin())
- [x] account deletion request exists (table + RLS + in-app flow)
