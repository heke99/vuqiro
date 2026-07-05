# Vuqiro API reference

Base URL: `API_BASE_URL` (default `http://localhost:3002`). All requests and
responses are JSON unless noted. Full contracts live in the route files under
`apps/api/src/routes/`; this reference lists every endpoint, its auth
requirement and purpose.

## Conventions

- **Auth**: `Authorization: Bearer <supabase access token>`. Rows in the table
  below: `public` (no auth), `optional` (personalizes when signed in), `user`
  (active account required), `admin(...)` (admin role required), `owner`
  (advertiser owner).
- **Errors**: `{ "error": string, "code"?: string }` with the appropriate HTTP
  status. Validation failures return 400 with `issues` (zod). Unhandled errors
  return 500 with no internals.
- **Rate limits**: 429 `{ "error": "Too many requests" }`. Violations are
  recorded server-side.
- **Pagination**: feeds and comments use opaque `cursor` / `nextCursor`
  values; admin lists use `limit`/`offset`; messages use `before` timestamps.
- **Idempotency**: wallet mutations accept an `idempotencyKey`; webhook
  processing and billing events are idempotent server-side.
- **Sources**: responses carry `source: "db" | "mock"`; mock appears only in
  credential-free development (production boots refuse mock providers).

## Public platform

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` (`?deep=1`) | public | Service + provider health |
| GET | `/feature-flags` | public | Client-safe flags (key + enabled) |
| GET | `/legal/documents` | public | Published legal documents |
| POST | `/legal/accept` | user | Record legal acceptances |
| GET | `/legal/acceptances` | user | Caller's acceptance history |

## Feeds

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/feed/for-you` (`cursor`, `session`) | optional | Ranked feed with server-inserted ads, promoted labels, `nextCursor` |
| GET | `/feed/following` | user | Videos from followed creators |
| GET | `/feed/trending` | optional | Recent-window trending |
| GET | `/feed/hashtag/:tag` | optional | Hashtag feed |
| GET | `/feed/sound/:id` | optional | Videos using a sound |
| GET | `/feed/premium` | optional | Locked/premium catalog (metadata only) |
| POST | `/feed/session/start` / `/feed/session/end` | optional | Feed session envelope |
| POST | `/feed/impression` | optional | Watch accounting (single or batch: watchedMs, completed, skippedQuickly, engagement flags) |
| POST | `/events` | optional | Batched analytics events (whitelisted names) |

## Videos and engagement

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/videos/:id` | optional | Public video metadata (no playback for locked) |
| GET | `/videos/:id/access` | user | Entitlement check; only source of locked playback URLs |
| POST | `/videos/:id/like` / `/save` | user | Toggle like/save (unique per user) |
| POST | `/videos/:id/not-interested` | user | Toggle negative feed signal |
| POST | `/videos/:id/share` | optional | Record a share (channel enum) |
| GET | `/videos/:id/comments` (`cursor`, `limit`) | optional | Paginated top-level comments + their replies |
| POST | `/videos/:id/comments` | user | Create comment |
| POST | `/comments/:id/replies` | user | Reply to a comment |
| POST | `/comments/:id/like` | user | Toggle comment like |
| DELETE | `/comments/:id` | user | Delete own comment |

## Uploads

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/videos/uploads` | user (creator) | Create draft + signed direct-upload URL (validates size/duration/visibility; moderation precheck) |
| GET | `/videos/:id/status` | user (owner) | Processing state machine |
| DELETE | `/videos/:id` | user (owner) | Delete own video + provider asset |

## Profiles and account

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET / PATCH | `/me` | user | Own profile (counters) / update (validated URLs) |
| POST | `/me/avatar-upload` | user | Signed avatar upload target |
| GET / PUT | `/me/settings` | user | Privacy settings |
| GET / PUT | `/me/safety-settings` | user | Safety settings (who-can-message, filters) |
| GET / PUT | `/me/interests` | user | Interest list (feed personalization) |
| GET | `/me/blocks` / `/me/mutes` | user | Block/mute lists |
| GET | `/me/saves` / `/me/likes` | user | Personal collections (visible content only) |
| GET | `/me/following` | user | Followed creators |
| GET / DELETE | `/me/searches` | user | Recent searches / clear history |
| POST | `/me/consents` | user | Consent events |
| POST/GET/DELETE | `/account/deletion` | user | Deletion request lifecycle (30-day window) |

## Creators and studio

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/creators/:id` | optional | Public creator profile |
| GET | `/creators/:id/videos` | optional | Storefront feed |
| GET | `/creators/:id/followers` | optional | Public follower list (paginated) |
| POST | `/creators/:id/follow` | user | Toggle follow |
| POST | `/creators/onboard` | user | Become a creator |
| GET | `/creators/me/videos` / `/subscribers` / `/moderation` | user (creator) | Studio data |
| POST | `/creators/me/tiers` | user (creator) | Tier configuration |
| GET | `/creators/me/analytics` | user (creator) | Own analytics summary |

## Search and discovery

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/search?q=` | optional | Creators + videos + hashtags (logs to search history) |
| GET | `/discover/trending` | optional | Trend snapshots (fresh) or live aggregation |
| GET | `/categories` | public | Active categories |
| GET | `/sounds?q=` | public | Sound search/trending |

## Messaging

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/messages/conversations` | user | Conversation list (other member, last message, unread) |
| POST | `/messages/conversations` | user | Open/create direct conversation (blocks + who-can-message enforced) |
| GET | `/messages/conversations/:id` (`before`, `limit`) | member | Thread messages |
| POST | `/messages/conversations/:id` | member | Send (permissions re-checked per send) |
| POST | `/messages/conversations/:id/read` | member | Mark read |

## Notifications

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | user | Inbox (+ unread count) |
| POST | `/notifications/read` | user | Mark one/all read |
| GET / POST | `/notifications/preferences` | user | Per-category + channel toggles |
| POST / DELETE | `/notifications/push-token` | user | Push token registration |

## Wallet and monetization

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/wallet` | user | Balance + transactions |
| POST | `/wallet/tip` / `/unlock` / `/boost` | user | Atomic coin spends (idempotency keys) |
| GET | `/monetization/packages` | public | Published catalog + store products |
| POST | `/payouts/onboarding` | user (creator) | Stripe Connect onboarding |
| GET | `/payouts/me` | user (creator) | Balances, payouts, holds |

## Ads (serving + self-serve)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/ads/serve` | optional | Ad selection for a placement |
| POST | `/ads/impression` / `/ads/click` | optional | Delivery accounting (CPM/CPC billing server-side) |
| POST | `/ads/report` | user | Report an ad |
| GET | `/advertiser/me` | owner | Owned advertisers + accounts |
| GET / POST | `/advertiser/campaigns` | owner | Own campaigns / create draft (min budget) |
| POST | `/advertiser/campaigns/:id/submit\|pause\|resume` | owner | Owner-safe transitions only |
| GET | `/advertiser/reporting` | owner | Own delivery metrics |

## Moderation, privacy and support

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/reports` | user | Report video/comment/profile/creator/message |
| POST | `/blocks` / `/mutes` | user | Toggle block/mute |
| POST | `/appeals` | user | Appeal a moderation decision |
| POST / GET | `/privacy/requests` | user | GDPR requests |
| GET | `/privacy/data-exports` | user | Export status |
| POST | `/copyright-claims` | public | DMCA-style claims |
| POST / GET | `/support-cases` | user | Support tickets |

## Webhooks (see docs/webhooks.md)

`POST /revenuecat/webhook`, `POST /stripe/webhook`,
`POST /video-provider/webhook` — signature-verified, idempotent.

## Admin (all `/admin/*`, server-side RBAC)

| Area | Endpoints |
|---|---|
| Dashboard | GET `/admin/dashboard` |
| Analytics | GET `/admin/analytics` (`from`, `to`, `format=csv`) |
| Users | GET `/admin/users`, GET `/admin/users/:id`, POST `/admin/users/:id/suspend\|unsuspend\|ban\|restore` |
| Creators | GET `/admin/creators(/:id)`, POST `/admin/creators/:id/verify\|reject\|enable-monetization\|disable-monetization` |
| Videos | GET `/admin/videos(/:id)`, GET `/admin/videos/:id/ranking` (inspector), POST `/admin/videos/:id/hide\|remove\|restore\|age-restrict\|ad-eligible\|ad-ineligible\|feature\|unfeature` |
| Comments | GET `/admin/comments`, POST `/admin/comments/:id/hide\|remove\|restore` |
| Moderation | GET `/admin/moderation`, GET `/admin/moderation/cases/:id`, POST `.../decide`, `.../reopen` |
| Fraud | GET `/admin/fraud-signals`, POST `/admin/fraud-signals/:id/resolve` |
| Ads suite | `/admin/ads/advertisers`, `/accounts`, `/campaigns` (+ transitions), `/groups`, `/creatives` (+ approve/reject), `/sponsorships` (+ activate/complete), `/reporting` (`format=csv`), `/billing`, `/reports` |
| Finance | `/admin/wallet/transactions`, `/admin/wallet/adjust`, `/admin/purchases`, `/admin/payouts` (+ batch/hold/release), `/admin/revenue/platform-ledger` + `/creator-ledger` (`format=csv`) |
| Compliance | `/admin/legal/*`, `/admin/privacy-requests`, `/admin/data-exports`, `/admin/deletion-requests`, `/admin/appeals`, `/admin/copyright-claims` |
| Ops | `/admin/admin-users`, `/admin/feature-flags`, `/admin/platform-settings`, `/admin/integration-health(/history)`, `/admin/rate-limit-events`, `/admin/support-cases`, `/admin/audit-logs`, `/admin/notifications/broadcast`, `/admin/notifications/process-jobs` |
| Jobs | POST `/admin/ops/trending/run`, `/admin/ops/analytics/run`, `/admin/ops/privacy/run` (cron-able, audit-logged) |

Every destructive/sensitive admin action writes an `audit_logs` row; audit
write failure aborts the action.
