# Vuqiro security model

The enforced security posture across the API, database, admin console and
mobile app. Complements `docs/architecture/security-baseline.md` (threat
model) and `docs/testing/security-checklist.md` (verification plan).

## Authentication and authorization

- **Identity**: Supabase Auth. Clients hold short-lived JWTs; the API verifies
  every Bearer token against Supabase (`anon.auth.getUser`) — no server
  sessions, nothing trusted from the client.
- **Consumer authorization**: `attachUser` (optional) / `requireUser`
  (mandatory + `profiles.status = 'active'`). Suspended/banned/deleted
  accounts get 403 everywhere.
- **Admin RBAC**: separate `admin_users` table (`platform_superadmin`, `admin`,
  `moderator`, `finance`, `support`). `requireAdmin(...roles)` guards every
  `/admin/*` route server-side; the admin console re-checks per page
  (`guardPage`) and hides navigation, but the API is the enforcement point.
- **Advertiser scoping**: `/advertiser/*` routes filter by
  `advertisers.owner_profile_id = caller`; owners can never read another
  advertiser's data or activate their own campaigns.
- **Session refresh**: admin/advertiser web middleware refreshes Supabase
  session cookies on every request.
- **Mock auth** exists only when Supabase is unconfigured, which
  `assertProductionSafety()` makes impossible in production (API refuses to
  boot; admin console shows a configuration error instead of mock identity).

## Database (RLS)

- All 92 public tables have RLS enabled; clients receive minimum policies
  (owner-scoped rows, world-readable catalogs, admin-scoped views). The API
  uses the service role and enforces authorization in middleware.
- Field-protection triggers stop self-escalation: users cannot change their
  own role/status, verification, monetization or moderation fields.
- Ledgers (`coin_transactions`, revenue ledgers, `ad_billing_events`,
  `audit_logs`, `consent_events`) are append-only via triggers.
- Money moves only through atomic SQL functions (`wallet_spend`,
  `wallet_credit`, `wallet_reverse`) with idempotency keys and balance locks.
- Reserved handles: signup and handle changes are blocked from taking
  platform/staff names (`is_reserved_handle`, trigger-enforced).

## Input validation

- Zod on every mutation; global handler converts validation errors to 400
  without stack traces.
- **URLs**: user-supplied links (profile website/avatar, ad CTA/media/
  thumbnails, advertiser websites) must pass `safeHttpUrl` — https only
  (http allowed solely for localhost in development), which blocks
  `javascript:`, `data:` and similar scheme abuse.
- Captions, comments and bios are stored as plain text and rendered as text
  (React Native `Text` / React JSX auto-escaping) — no HTML rendering paths.
- File uploads: server-side type/size validation, signed upload URLs, storage
  bucket policies; avatars/thumbnails restricted to image content types (no
  SVG/executable uploads).

## Rate limiting and abuse

- Fixed-window limiter on auth-adjacent and engagement mutations (uploads,
  comments, likes, follows, reports, messages, campaign creation, events…).
- Violations are persisted to `rate_limit_events` (throttled) and visible in
  the ops console.
- Anti-abuse signals: repeated-report detection, fraud signals, spam
  downranking in the feed, mass-report escalation via case priorities.
- Known limitation: the limiter is per-instance in-memory; multi-instance
  deployments need a shared store (documented in known-limitations).

## Content access control

- Playback URLs for non-public videos are never returned in feeds; the
  `/videos/:id/access` endpoint verifies the entitlement (follow, coin
  unlock, membership tier) server-side before releasing a URL.
- **Signed playback** (optional): when `MUX_SIGNING_KEY_ID` +
  `MUX_SIGNING_PRIVATE_KEY` are set, every Mux stream URL leaving the API is
  signed with a short-lived RS256 token, so leaked URLs expire.
- Blocked users are invisible both ways; muted creators disappear from feeds;
  moderation states (`removed`, `blocked`, `under_review`) hide content
  everywhere, including personal collections.

## Webhooks

| Webhook | Verification | Idempotency |
|---|---|---|
| RevenueCat | Authorization secret | `revenuecat_webhook_events.event_id` unique |
| Stripe | HMAC signature | `purchase_events (provider, provider_event_id)` |
| Mux | HMAC signature + 5-min replay window | `video_processing_jobs (provider, provider_event_id)` |

## Transport and headers

- API: `x-content-type-options`, `x-frame-options: DENY`,
  `referrer-policy: no-referrer`, `cache-control: no-store`,
  `cross-origin-opener-policy`, `permissions-policy`, HSTS in
  staging/production. CORS requires an explicit allowlist in production
  (empty allowlist blocks browsers).
- Admin console (Next.js): equivalent header set via `next.config.js`.

## Auditing

- Every sensitive admin action (enforcement, payouts, ads review, settings,
  flags, broadcasts, job runs) writes an append-only `audit_logs` row; a
  failed audit write aborts the action.
- Consent changes append to `consent_events`; legal acceptances are versioned.

## Privacy

- GDPR foundations: privacy requests, data export worker (JSON bundle in the
  private `legal-exports` bucket, owner-only signed download, 7-day expiry),
  account deletion with a 30-day grace window followed by anonymization and
  content soft-deletion.
- Reporter identities are never exposed to reported users.
- Logs contain no PII, tokens or bodies (structured request logs only).
- Secrets live only in server-side env (`SUPABASE_SERVICE_ROLE_KEY`, Stripe,
  Mux, Resend keys); nothing secret is prefixed `EXPO_PUBLIC_`/`NEXT_PUBLIC_`.

## Error handling

- Known errors map to typed API errors with clean messages; unhandled errors
  return `{"error":"Internal server error"}` with no stack trace. Stack
  traces go to server logs/Sentry only.

## Verification

- Permission-boundary tests cover: admin RBAC per route, advertiser scoping,
  messaging auth, moderation roles, webhook signature rejection, URL scheme
  rejection, rate-limit responses, CSV export auth. Run with `pnpm test`.
