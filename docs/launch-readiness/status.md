# Launch readiness status

Tracks the launch gap closure batches (see `docs/launch-readiness/audit.md` for the
underlying audit) and the external dependencies that remain after the code is done.

## Batch status

| Batch | Scope | Status |
|---|---|---|
| B0 | Audit docs, admin readiness page fix, public feature-flags endpoint | Done |
| B1 | Schema: mutes, not-interested, featured, rate_limit_events, advertiser linkage, search indexes | Done |
| B2 | Ranking: configurable weights, real signals, explain endpoint, trending snapshots | Done |
| B3 | Engagement: not-interested/mute APIs, comment pagination + replies, double-tap like, mute toggle, clipboard | Done |
| B4 | Mobile wiring: discover/search/hashtag feeds, real profiles, saves/likes/follower lists, production-gated mocks | Done |
| B5 | Watch tracking accuracy + player preloading/posters | Done |
| B6 | Messaging: API routes + mobile inbox/chat | Done |
| B7 | Ads: advertiser self-serve, CSV exports, daily pacing, promoted labels | Done |
| B8 | Notifications: email adapter, deep links, dedupe; data-export/deletion workers; rate-limit logging | Done |
| B9 | Analytics: rollup job, admin analytics page, CSV export | Done |
| B10 | Security hardening + docs/security.md + permission tests | Pending |
| B11 | API/env/deployment/launch docs, CI migration validation, final gate | Pending |

## B0 changes

- Added `docs/launch-readiness/audit.md` (full repo audit) and this status file.
- `apps/admin/app/app-store-readiness/page.tsx`: now calls `guardPage()`, renders a
  code-maintained operational checklist, and no longer imports mock data or fake
  "Mark done" buttons. `MockAction` component and `mockReadinessItems` removed.
- `AdminApiAction` no longer has a fake-success path: it always calls the API
  (defaulting to `http://localhost:3002` like every other admin fetch) and surfaces
  failures as error flashes.
- New public `GET /feature-flags` endpoint (key + enabled only, environment-filtered)
  backed by the `feature_flags` table; mobile fetches it through
  `apps/mobile/src/services/data/featureFlags.ts` and the upload screen now respects
  the `video_upload` flag. Deleted the dead hardcoded
  `apps/mobile/src/config/featureFlags.ts`.

## B1 changes

- New migration `20260705120000_launch_gap_closure.sql` (schema now 92 tables, all
  with RLS): `mutes`, `video_not_interested`, `rate_limit_events`,
  `videos.is_featured/featured_at/featured_by`, `advertisers.owner_profile_id`,
  `notification_jobs.provider_message_id`, `pg_trgm` search indexes on captions,
  handles, display names, hashtags and sound titles. Owner-scoped policies for the
  new user tables; admin-read for rate-limit events.
- `scripts/validate-migrations.sh` extended with launch-gap-closure assertions
  (new tables, columns, trigram indexes; table floor raised to 92). Verified green
  against local Postgres 16.
- Seed: one featured video, one mute, one not-interested row.
- Canonical schema documentation added at `docs/database.md`; the stale
  `docs/architecture/database-schema.md` now points to it.

## B2 changes

- `platform_settings.feed_weights` is now actually applied: `scoreVideo`/`rankVideos`
  accept sanitized weight multipliers (0–10, invalid values ignored) and
  `rankFeedRows` loads them per request (30s cache). Added a `featured` weight and
  ranking factor — featured videos get extra distribution, but only while
  moderation-visible.
- Real ranking signals: `creatorFollowerCount` now comes from
  `profiles.follower_count`; category/hashtag interest matching now uses the
  viewer's `user_interests`.
- Feed candidate filtering: For You excludes not-interested videos; all feed
  surfaces exclude muted creators (blocked stays global; muted users remain
  searchable).
- New admin ranking inspector: `GET /admin/videos/:id/ranking` returns the full
  factor breakdown + input snapshot + active weights; new admin page
  `/videos/[id]` renders it with enforcement + feature/unfeature actions.
- Feature/suppress: `POST /admin/videos/:id/feature|unfeature` (audit-logged,
  records `featured_by`/`featured_at`).
- Trending snapshots: `computeTrendSnapshots()` scores recent watch events +
  likes/shares in a daily/weekly window (visible, public, ready content only) and
  writes `trend_snapshots`; `POST /admin/ops/trending/run` triggers it (cron-able,
  audit-logged, button on the Integration health page). `/discover/trending` now
  prefers fresh snapshots and falls back to live aggregation.
- Tests: weight multiplier behaviour, featured eligibility, inspector RBAC,
  trending job validation (10 new tests).

## B3 changes

- API: `POST /videos/:id/not-interested` (toggle, writes a negative `video_skip`
  signal), `POST /mutes` (toggle; accepts a profile id or creator id and resolves
  server-side), `GET /me/mutes`, all rate-limited. `GET /videos/:id/comments` is
  now cursor-paginated over top-level comments (replies for the page ride along)
  and returns `nextCursor`.
- Mobile: double-tap-to-like with heart burst + single-tap pause/play on the feed
  player; sound on/off toggle in the action rail (feed-wide state); new "More"
  options modal (not interested / mute creator / report); feed hides muted
  creators and not-interested videos locally; comment sheet gained reply posting
  (with reply banner + optimistic insert/rollback) and "Load more" pagination;
  share sheet "Copy link" now actually writes to the clipboard (expo-clipboard);
  video detail Like/Save buttons wired to the social context and API.
- Tests: `engagement.test.ts` (auth, mute validation, rate limiting, pagination
  contract) — 9 new tests.

## B4 changes

- API: `GET /videos/:id` (public metadata, feed visibility rules, no playback for
  locked content), `GET /creators/:id/followers` (public, paginated, active
  accounts only), `GET /me/saves`, `GET /me/likes`, `GET /me/following`,
  `GET/DELETE /me/searches` (recent searches reuse `search_events`; `/search` now
  logs queries). New analytics event names `search_performed` and
  `video_qualified_view`.
- Mobile Discover is fully live: debounced API search, trending/categories from
  the API, recent searches with clear-history, hashtag chips navigate to a new
  full-screen vertical hashtag feed (`/hashtag/[tag]`), thumbnails render.
- Profiles: own profile shows real follower/following/video/like counts from
  `/me` plus links to new Saved videos, Liked videos and Following screens;
  public creator profiles and the video detail screen now load live API data with
  loading/not-found states; locked-content and subscribe modals fetch live
  metadata.
- Demo gating: new `src/services/data/demoMode.ts` is the single gate — every
  mock fallback (feed, discover, creator profile, video detail, inbox, wallet,
  studio, comments, locked/subscribe modals) is disabled when
  `EXPO_PUBLIC_APP_ENV=production`, surfacing real error/empty states instead.
- Tests: collections/public-video/follower endpoints (+8 API tests).

## B5 changes

- The feed now keeps one open "watch" per active video and finalizes it when the
  viewer moves on (or leaves the feed): `feed_impressions` rows carry real
  `watchedMs`, `completed` and `skippedQuickly` values instead of empty
  impressions at view start.
- New client events: `video_qualified_view` (≥2s or completed) and `video_skip`
  (<2s, not completed) flow into the `/events` pipeline that feeds the ranking
  engine; completion is reported by the player through `onWatchComplete`.
- Player: poster thumbnails render while the stream buffers (no black flash on
  swipe); neighbouring feed items keep pre-created paused players
  (windowSize 5), so the next video starts instantly.
- `computeWatchOutcome` extracted and unit-tested (3 new tests).

## B6 changes

- Migration `20260705140000_messaging_completion.sql`: messages became reportable
  (`reports`/`moderation_cases` target type checks), `new_message` notification
  type + `notification_preferences.messages` toggle,
  `conversations.last_message_at` for ordering.
- New API surface `/messages/*` over the existing tables: conversation list with
  other-member profile, last message and unread state; open/create direct
  conversations (by profile id or creator id); paginated thread fetch; send
  (4000-char cap, rate limited, re-checks permissions each send); mark-read.
  Server-side rules: blocks in either direction always win;
  `user_safety_settings.who_can_message` is the single source of truth
  (`everyone`/`followers`/`no_one` — followers requires following the recipient's
  creator account); removed messages render as placeholders; recipients get a
  `new_message` notification honoring their preferences.
- Mobile: Inbox now has Notifications | Messages tabs with unread badges; new
  chat screen (`/messages/[id]`) with optimistic sends, rollback, light polling
  and report action; "Message" button on creator profiles opens or creates the
  conversation; notification preferences include Direct messages.
- Tests: `messages.test.ts` (auth on all routes, open/create, validation, rate
  limiting, message reports) — 7 new tests.

## B7 changes

- Advertiser self-serve API (`/advertiser/*`): owners (linked via
  `advertisers.owner_profile_id`, set by admins) see only their advertisers,
  accounts, campaigns and reporting; can create draft campaigns (min budget
  $10, platform-priced CPM/CPC), submit for review, pause/resume. Activation
  and rejection remain admin-only.
- Advertiser portal UI at `/advertiser` in the admin app deployment — separate
  shell + non-admin Supabase auth (new `middleware.ts` exposes the pathname to
  the root layout and refreshes Supabase sessions on every request, closing the
  previously documented session-refresh gap).
- Daily budget pacing: campaigns with `daily_budget_cents` stop serving once
  today's billing events reach it.
- Promoted disclosure: for-you feed marks actively boosted videos
  `promoted: true`; the mobile feed renders a "Promoted" badge.
- CSV exports: `format=csv` on ad reporting, platform revenue ledger and
  creator revenue ledger; admin console export buttons proxy through
  `/api/export/[name]` (allowlisted, session-authenticated).
- `docs/ads.md` written (entities, lifecycle, serving rules, billing,
  self-serve, sponsor deals, boosts, superadmin controls).
- Tests: advertiser scoping/validation/transitions + CSV auth (9 new tests);
  admin production build verified with the new middleware.

## B8 changes

- Email provider adapter in `packages/services` (Resend + mock, provider
  pattern identical to push/video/payouts): `EMAIL_PROVIDER`, `RESEND_API_KEY`,
  `EMAIL_FROM` env vars, health check included in `/health?deep=1` and the
  integration-health console (new `email` provider in the health snapshot
  constraint via migration `20260705150000_ops_email.sql`). Missing email in
  production is a warning, not a boot blocker.
- The notification job runner now processes the `email` channel: recipient
  addresses resolve through the Supabase auth admin API (never stored on
  profiles), receipts store `provider_message_id`, retries up to 3 attempts.
- `notifyProfile` now dedupes repeats (same type + same related profile/video
  within an hour collapses to one notification) and fans out to
  `notification_jobs`: push when the user enabled it, email for payout,
  moderation and system/security notices.
- Mobile inbox deep links: notifications open their video, payout notices open
  the studio payouts screen, message notices switch to the Messages tab.
- Privacy workers (`apps/api/src/lib/privacyWorkers.ts`): data exports build a
  full JSON bundle into the private `legal-exports` bucket and flip
  `data_exports` to `ready` with a 7-day expiry; account deletions past their
  30-day window anonymize the profile, soft-delete videos and deactivate push
  tokens. Triggered by `POST /admin/ops/privacy/run` (audit-logged, cron-able,
  button on Integration health).
- Rate-limit violations now persist to `rate_limit_events` (throttled to one
  row per key per minute) with an admin viewer on the Integration health page
  (`GET /admin/rate-limit-events`).
- Tests: mock email provider, privacy-workers RBAC, rate-limit-events RBAC.

## B9 changes

- Daily analytics rollup job (`apps/api/src/lib/analyticsRollup.ts`):
  aggregates one UTC day of `feed_impressions` + likes/comments/saves/shares
  into `video_analytics_daily` and `creator_analytics_daily` (idempotent
  upserts; follower gains and coin earnings included). Triggered by
  `POST /admin/ops/analytics/run` (optional `date`, audit-logged, cron-able,
  button on Integration health + the analytics page).
- `GET /admin/analytics` rebuilt: `from`/`to` date filters, totals (new users,
  uploads, published videos, views, watch hours, completions, engagement,
  reports, moderation actions, revenue, ad impressions/clicks), per-day series
  from the rollup tables (no raw event scans in the dashboard path), top videos
  and top creators, plus `format=csv`.
- New admin `/analytics` page (admin + finance roles): date filters, metric
  cards, daily series table, top videos/creators, CSV export button (new
  `platform-analytics` entry in the export proxy allowlist).
- Tests: rollup RBAC + date validation, analytics totals/series, CSV export
  (6 new tests). Admin production build verified.

## Open external dependencies

These cannot be closed from code and require owner action:

| Dependency | Needed for | Where documented |
|---|---|---|
| Production Supabase project (+ `supabase db push`, first superadmin row) | Everything | `docs/launch/go-live-checklist.md` |
| Mux account + keys (`VIDEO_PROVIDER=mux`) | Real video processing/playback | `docs/architecture/video-pipeline.md` |
| RevenueCat project + store products | Coin purchases, subscriptions | `docs/architecture/revenuecat-mapping.md` |
| Stripe account + Connect | Creator payouts | `docs/architecture/stripe-connect-payouts.md` |
| Apple Developer / Google Play accounts | Store submission | `docs/app-store/` |
| Expo/EAS account (+ optional `EXPO_ACCESS_TOKEN`) | Builds, push notifications | `docs/implementation/eas-builds.md` |
| Email provider key (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`) | Email notifications | `.env.example` |
| Sentry DSN | Error monitoring | `.env.example` |
| Legal counsel review of `docs/legal/` outlines | Published legal pages | `docs/legal/` |
