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
| B6 | Messaging: API routes + mobile inbox/chat | Pending |
| B7 | Ads: advertiser self-serve, CSV exports, daily pacing, promoted labels | Pending |
| B8 | Notifications: email adapter, deep links, dedupe; data-export/deletion workers; rate-limit logging | Pending |
| B9 | Analytics: rollup job, admin analytics page, CSV export | Pending |
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
| Email provider key (Resend) | Email notifications (adapter added in B8) | `docs/env.md` (B11) |
| Sentry DSN | Error monitoring | `.env.example` |
| Legal counsel review of `docs/legal/` outlines | Published legal pages | `docs/legal/` |
