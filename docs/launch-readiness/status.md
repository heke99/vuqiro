# Launch readiness status

Tracks the launch gap closure batches (see `docs/launch-readiness/audit.md` for the
underlying audit) and the external dependencies that remain after the code is done.

## Batch status

| Batch | Scope | Status |
|---|---|---|
| B0 | Audit docs, admin readiness page fix, public feature-flags endpoint | Done |
| B1 | Schema: mutes, not-interested, featured, rate_limit_events, advertiser linkage, search indexes | Pending |
| B2 | Ranking: configurable weights, real signals, explain endpoint, trending snapshots | Pending |
| B3 | Engagement: not-interested/mute APIs, comment pagination + replies, double-tap like, mute toggle, clipboard | Pending |
| B4 | Mobile wiring: discover/search/hashtag feeds, real profiles, saves/likes/follower lists, production-gated mocks | Pending |
| B5 | Watch tracking accuracy + player preloading/posters | Pending |
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
