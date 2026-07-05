# Vuqiro repository audit

Date: 2026-07-05. Scope: full monorepo prior to the launch gap closure pass.

## Stack

| Layer | Implementation |
|---|---|
| Mobile app | Expo (React Native) + Expo Router, `expo-video` player, RevenueCat SDK, Expo push |
| Admin console | Next.js App Router (server components + client action forms), Supabase SSR auth |
| API | Hono service (`apps/api`), stateless Bearer JWT verified against Supabase Auth |
| Database | Supabase Postgres — 89 tables, RLS enabled on every public table |
| Video | Mux adapter (direct uploads, webhooks, HLS) with a mock provider for dev |
| Payments | RevenueCat (IAP/coins) + Stripe Connect (creator payouts), both with mock adapters |
| Push | Expo push adapter + mock |
| Shared packages | `@vuqiro/types` (17 domains), `@vuqiro/config` (zod env + production guard), `@vuqiro/services` (provider adapters), `@vuqiro/ui` (tokens + admin components), `@vuqiro/mock-data` (dev/test fixtures) |

## What already works

- **Auth/RBAC**: Supabase Auth on clients; API validates JWTs and loads `profiles` /
  `admin_users`. Admin roles: `platform_superadmin`, `admin`, `moderator`, `finance`,
  `support`. Every admin route re-checks roles server-side; admin pages use
  `guardPage()` + nav filtering.
- **Feed**: For You / Following / Trending / hashtag / sound / premium feeds with a
  deterministic explainable ranking engine (`apps/api/src/lib/ranking.ts`), server-side
  ad insertion, feed sessions and impression ingestion.
- **Uploads**: direct-upload flow through Mux (or mock) with webhook-driven state
  machine (`uploading → processing → ready | under_review | rejected`), moderation
  precheck, rate limits.
- **Engagement**: likes, saves, shares, follows, threaded comments, comment likes,
  blocks, reports — all DB-backed with unique constraints and counter triggers.
- **Ads**: advertisers → ad accounts → campaigns → groups → creatives lifecycle with
  review states, targeting, frequency caps, CPM/CPC billing ledgers, direct
  sponsorship deals, platform revenue ledger, in-feed serving.
- **Wallet/monetization**: atomic coin wallet functions, tips, coin unlocks, boosts,
  RevenueCat purchases (idempotent webhooks), creator memberships, revenue ledgers,
  Stripe Connect payouts with holds and batch processing.
- **Moderation**: reports → moderation cases → decisions/actions, appeals, copyright
  claims, fraud signals, automated rules, audit logs (append-only).
- **Privacy/legal**: GDPR privacy requests, data export records, account deletion
  requests, consent events, versioned legal documents + acceptances.
- **Ops**: platform settings, feature flags, admin invitations, integration health,
  support cases, notification jobs, broadcast.
- **Safety guard**: `assertProductionSafety()` refuses to boot the API in production
  without real providers; admin console blocks mock identity in production.
- **CI**: lint + typecheck + 222 tests on push/PR.

## Gaps found (closed by the launch gap closure pass)

### Mobile
- Discover, creator profiles and video detail rendered mock data even when the API
  was configured.
- Mock fallbacks were not production-gated (a production build with an unreachable
  API silently showed demo data).
- Missing: double-tap like, player mute toggle, not-interested, mute user, comment
  replies (post) and pagination, clipboard copy on share, saved/liked video screens,
  follower/following lists, real profile stats, notification deep links.
- Watch tracking did not send `watchedMs`, `completed`, `skippedQuickly` or skip
  events; no qualified-view signal.
- Dead `src/config/featureFlags.ts` never imported anywhere.

### API
- `platform_settings.feed_weights` stored but never read by the ranking engine;
  `creatorFollowerCount` and interest matching hardcoded to 0 in
  `feedRanking.ts`.
- No not-interested or mute endpoints; no comment cursor pagination.
- No ranking-explain endpoint for admins.
- No messaging routes despite `conversations`/`messages` tables existing.
- No CSV exports; no data-export/deletion workers; no trending snapshot job; no
  daily ad budget pacing.
- Rate limiting in-memory only, violations not persisted.

### Admin
- No analytics page with date filters; no ranking inspector; no CSV export.
- `/app-store-readiness` was static mock content with fake action buttons and no
  `guardPage()` call.
- No advertiser self-serve surface.

### Schema
- Missing: `mutes`, `video_not_interested`, `videos.is_featured`,
  `rate_limit_events`, `advertisers.owner_profile_id`, trigram search indexes.

### Docs
- No `docs/launch-readiness/`, `docs/api.md`, `docs/database.md`, `docs/ads.md`,
  `docs/security.md`, `docs/env.md`, `docs/deployment.md`, `docs/launch-checklist.md`.
- `docs/architecture/database-schema.md` stale (39-table snapshot).

## Source-of-truth decisions

To avoid parallel duplicate systems:

- **Messaging**: finish on the existing `conversations` / `conversation_members` /
  `messages` tables; UI lives inside the existing Inbox tab.
- **Advertiser portal**: a scoped route group inside the existing admin Next.js app;
  advertisers link to auth users via `advertisers.owner_profile_id`; all advertiser
  writes flow through the existing `pending_review` campaign lifecycle.
- **Recent searches**: reuse the existing `search_events` table (no new
  search-history table).
- **Email**: new provider adapter in `packages/services` consumed by the existing
  `notification_jobs` queue (no separate email pipeline).
- **Feature flags**: single source is the `feature_flags` table exposed through a
  client-safe `GET /feature-flags`; the hardcoded mobile flag file was removed.
- **Readiness checklist**: operational documentation maintained in the admin page
  source + `docs/launch/go-live-checklist.md`; removed from `@vuqiro/mock-data`.
