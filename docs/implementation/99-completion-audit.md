# Vuqiro 99% Completion Audit

Full repository audit performed before the 99%-completion implementation pass.
Classification: **P0** = blocker before live, **P1** = required for a complete
TikTok-like product, **P2** = useful after launch.

## 1. What already exists

The repository is a working pnpm monorepo built over 23 implementation batches:

- **`apps/mobile`** — Expo Router app: vertical `expo-video` feed with autoplay,
  For You / Following tabs, discover, upload pipeline (session → PUT → poll),
  creator studio (6 screens), inbox, wallet UI, settings, 5 legal pages,
  6 modals (comments, share, report, coins, subscribe, locked content),
  Supabase auth with session restore and account deletion requests.
- **`apps/admin`** — Next.js console with 19 pages (dashboard, users, creators,
  videos, comments, moderation, fraud-safety, monetization suite, payouts,
  notifications, legal, feature flags, settings, audit log, store readiness),
  Supabase sign-in gate against `admin_users`.
- **`apps/api`** — Hono service with 21 route modules: feed (for-you /
  following / hashtag / premium), videos, uploads, comments, creators, creator
  studio, discovery/search, analytics events, wallet (tip/unlock/boost),
  monetization, payouts, notifications, legal, moderation, appeals, admin
  (dashboard / moderation / fraud / payout holds), RevenueCat + Stripe + video
  provider webhooks. Rate limits, audit-log helper, security headers,
  request-ID logging, Zod validation.
- **`supabase/migrations`** — 7 migrations, 39 tables, RLS enabled on every
  table, field-protection triggers, atomic + idempotent wallet functions
  (`wallet_spend`/`wallet_credit`/`wallet_reverse`).
- **`packages/*`** — typed env contract (`config`), Mux/mock video and
  Stripe/mock payout adapters (`services`), 14 domain type modules (`types`),
  deterministic mock datasets (`mock-data`), design tokens + admin components
  (`ui`).
- **`docs/`** — 66 markdown files: architecture, 23 batch reports, legal
  outlines, testing plans, app-store readiness, launch checklist.
- **136 tests** (12 API test files + config + mock-data) all green;
  `scripts/validate-migrations.sh` validates schema, RLS and wallet atomicity.

## 2. What is only mock

| Area | Detail | Priority |
|---|---|---|
| Admin console reads | Every admin page imports from `@vuqiro/mock-data`; no page queries the API/DB | P0 |
| Mobile wallet | Static 1,250 coin balance, mock transactions, unlock button does nothing | P0 |
| Mobile discover | Client-side filtering over mock creators/videos/hashtags | P1 |
| Mobile comments | Mock list; new comments local-only (API endpoints exist but unused) | P0 |
| Mobile reports | Reason picker UI never calls `POST /reports` | P0 |
| Mobile share | Static URL + fake "Copied!"; no native share, no share count | P1 |
| Mobile video detail / creator profile | Mock data only | P1 |
| Admin actions | Most action buttons are `MockAction` flash toasts | P0 |

## 3. What lacks real API integration

- Admin console: all list/detail reads (users, creators, videos, comments,
  moderation, payouts, legal, flags, audit) — P0.
- Mobile: comments, reports, share, wallet, unlock, boost, discover/search,
  profile stats, blocked-user management, notification push tokens — P0/P1.
- Mobile feed: single fetch of ≤50 items; no cursor pagination, no feed
  sessions, no ad slots — P0.

## 4. What lacks real Supabase integration

- API has a real Supabase path for every existing route, but **silently falls
  back to mock** when `SUPABASE_SERVICE_ROLE_KEY` is missing — including in
  production (`appEnv=production`). P0.
- Admin auto-logs-in a mock superadmin when Supabase env is missing. P0.
- No Supabase Storage buckets/policies defined (avatars, ad creatives,
  exports). P1.

## 5. Existing database tables (39)

`profiles`, `admin_users`, `creators`, `creator_profiles`, `feature_flags`,
`account_deletion_requests`, `videos`, `video_assets`, `video_events`,
`follows`, `likes`, `saves`, `blocks`, `comments`, `comment_likes`,
`moderation_cases`, `reports`, `moderation_actions`, `notifications`,
`notification_preferences`, `legal_documents`, `legal_acceptances`,
`audit_logs`, `monetization_packages`, `monetization_package_versions`,
`store_products`, `purchases`, `purchase_events`, `revenuecat_webhook_events`,
`wallets`, `coin_transactions`, `creator_memberships`,
`creator_membership_entitlements`, `creator_revenue_ledger`,
`creator_payout_accounts`, `creator_payouts`, `payout_holds`,
`boost_campaigns`, `fraud_signals`.

## 6. Missing database tables

| Group | Tables | Priority |
|---|---|---|
| Ads | `ad_accounts`, `advertisers`, `ad_campaigns`, `ad_groups`, `ad_creatives`, `ad_impressions`, `ad_clicks`, `ad_conversions`, `ad_billing_events`, `direct_sponsorship_deals`, `platform_revenue_ledger`, `ad_frequency_caps`, `ad_reports` | P0 |
| Privacy/consent | `privacy_requests`, `data_exports`, `consent_events` | P0 |
| Moderation/legal | `appeals` (table — appeals currently piggyback on moderation cases), `copyright_claims`, `moderation_rules`, `content_safety_signals` | P0/P1 |
| Feed/analytics | `feed_sessions`, `feed_impressions`, `recommendation_events`, `search_events`, `video_analytics_daily`, `creator_analytics_daily`, `trend_snapshots` | P1 |
| Content graph | `hashtags`, `video_hashtags`, `categories`, `sounds`, `video_sounds`, `shares`, `mentions` | P1 |
| Users/prefs | `profile_settings`, `user_interests`, `user_safety_settings`, `user_devices`, `push_tokens` | P0/P1 |
| Pipeline | `video_upload_sessions`, `video_processing_jobs` | P1 |
| Ops | `platform_settings`, `admin_invitations`, `integration_health_checks`, `support_cases`, `ops_jobs`, `notification_jobs` | P0/P1 |
| Messaging | `conversations`, `conversation_members`, `messages` | P2 |

## 7. Existing RLS policies

All 39 tables have RLS with a consistent model: service-role writes for
sensitive tables; owner-scoped read/write for profiles, settings, wallets,
notifications; public read for published catalogs/videos; `is_admin()` gates
for moderation/audit/fraud. Field-protection triggers stop privilege
escalation on `profiles`/`creators`/`videos`. `audit_logs` append-only.

## 8. Missing RLS policies

- All ~50 new tables (section 6) need RLS + policies. P0.
- Role-granular helpers missing: `has_admin_role(text)`,
  `is_platform_superadmin()` (only `is_admin()`/`is_superadmin()` exist), so
  finance/moderator scoping happens only in the API today. P1.

## 9. Existing mobile screens

Welcome, sign-in, create-account, feed, discover, upload, inbox, wallet,
profile, creator/[id], video/[id], settings, notification-preferences,
5 legal pages, 6 modals, 6 studio screens.

## 10. Missing mobile screens

| Screen | Priority |
|---|---|
| Onboarding: interests, language, country, creator choice, ads consent, notification permission | P0 |
| Suspended / banned / deletion-pending account screens | P0 |
| Edit profile + avatar | P1 |
| Blocked users management | P1 |
| Privacy / safety settings (real, table-backed) | P0 |
| Data export request | P0 |
| Sponsored ad card in feed | P0 |
| Saved / liked video grids | P1 |

## 11. Existing admin pages

19 pages listed in section 1 — all reading mock data.

## 12. Missing admin pages

| Page | Priority |
|---|---|
| Ads suite: advertisers, campaigns, ad groups, creatives, sponsorship deals, ads reporting | P0 |
| User / creator / video detail pages | P1 |
| Reports (standalone), appeals, copyright claims | P0 |
| Wallet transactions, purchases, revenue ledger (creator + platform) | P0 |
| Admin users management + invitations | P0 |
| Integration health | P0 |
| Support cases | P1 |
| Privacy requests / data exports | P0 |

## 13. Existing API routes

~45 endpoints across feed, videos, uploads, comments, creators, studio,
discovery, events, analytics, wallet, monetization, payouts, notifications,
legal, moderation, appeals, admin, webhooks, health (see
`docs/architecture/api-contracts.md`).

## 14. Missing API routes

| Group | Priority |
|---|---|
| Ads: serve, impression, click, report + full admin CRUD + sponsorships | P0 |
| Privacy requests, data exports, account deletion (API-side) | P0 |
| Feed: cursor pagination, sessions, impressions, trending | P0 |
| Profile edit + avatar upload; blocked-users list/unblock | P1 |
| Comment like/delete/report; share endpoint | P1 |
| Push token registration; admin broadcast; notification jobs | P1 |
| Admin: users/creators/videos/comments CRUD-actions, admin-users, feature flags, platform settings, integration health, support cases, legal publishing | P0 |
| Sounds/categories search | P2 |

## 15. Existing provider adapters

- Video: `MuxVideoProvider` + `MockVideoProvider` (createDirectUpload,
  getAsset, deleteAsset, verifyWebhookSignature).
- Payouts: `StripePayoutsProvider` + `MockPayoutsProvider`.
- Payments: interface in `packages/services`; RevenueCat + mock impls in
  `apps/mobile`.

## 16. Missing provider adapters

- Push provider (Expo Push HTTP API + mock) — P0.
- Provider `healthCheck()` methods and integration-health reporting — P0.
- Video webhook idempotency (stored provider event IDs) — P1.

## 17. Existing tests

136 tests: 12 API test files (auth, RBAC, feeds, wallet, payouts, webhooks,
moderation, fraud, legal, notifications, studio, ranking), config env tests,
mock-data integrity tests. Mobile and admin apps: zero tests.

## 18. Missing tests

- API: ads serving/CRUD, feed ad insertion, privacy/deletion, admin
  users/settings, feed sessions — P0.
- Mobile: API client, feed mapper, upload state machine, optimistic social — P1.
- Admin: RBAC nav filtering, guards, mappers — P1.
- Migration validation for new tables/RLS — P0.

## 19. External credentials required (the remaining 1%)

Supabase production project, Mux (or other video provider) account,
RevenueCat account + store products, Stripe Connect account, Apple Developer
account, Google Play Console account, Expo/EAS production builds, Sentry
project, legal review, manual device QA, store approvals.

## 20. Risks

- **Silent mock in production** is the largest structural risk: a deployment
  with missing env would serve fake data. Fixed by `assertProductionSafety()`.
- Denormalized counters (`like_count` etc.) are updated only by API code;
  moving to DB triggers removes drift risk.
- In-memory rate limiting isn't multi-instance safe (documented; acceptable
  for launch scale, P2 to move to a shared store).
- AGPL reference projects (Loops, PeerTube) must never be code sources —
  enforced by the OSS intake process.

## 21. Implementation order

1. **Batch A** — this audit + OSS intake docs (P0 process gate).
2. **Batch B** — database completion: 4 append-only migrations, counter
   triggers, RLS, indexes (P0).
3. **Batch C** — config/env hardening, push adapter, health checks, CORS,
   production mock-guard (P0).
4. **Batch D** — API expansion: ads, admin, privacy, feed sessions/pagination,
   storage (P0).
5. **Batch E** — admin console: real data + RBAC + missing pages (P0).
6. **Batch F** — mobile completion: onboarding, wiring, ads display, push (P0).
7. **Batch G** — seed, tests, docs, final quality gate (P0).
