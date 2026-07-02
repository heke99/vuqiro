# Vuqiro API Contracts

Service: `apps/api` (Hono, TypeScript). Base URL: `API_BASE_URL` (default
`http://localhost:3002`).

## Conventions

- **Auth**: `Authorization: Bearer <supabase access token>`. The API verifies
  the JWT against Supabase Auth and loads the caller's profile. Suspended or
  banned accounts get `403` on any mutating route.
- **Admin auth**: same bearer token, but the user must have an active
  `admin_users` row. Role-restricted routes list required roles below.
- **Mock mode**: when Supabase env vars are absent the API serves mock data
  and accepts any bearer token; responses carry `"source": "mock"`.
- **Validation**: all bodies are Zod-validated; failures return
  `400 { error: "Validation failed", issues: [...] }`.
- **Errors**: `{ error, code }` with proper status (`401 unauthorized`,
  `403 forbidden`, `404 not_found`, `409 conflict`, `429 rate_limited`).
- **Rate limits** (per user): follows 60/min, likes/saves 120/min,
  comments 20/min, reports 20/hour, blocks 60/hour, tips/unlocks 30/min.
- **Idempotency**: wallet mutations require `idempotencyKey` (8–128 chars);
  webhook events are unique on provider event id.

## Endpoints

### Public / user

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Service health + active providers |
| GET | `/feed/for-you` | optional | Ranked ready+visible videos; blocked creators removed; locked items never include `playbackUrl` |
| GET | `/feed/following` | optional | Videos from followed creators |
| GET | `/creators/:id` | optional | Creator profile + storefront + live follower/subscriber counts |
| POST | `/creators/:id/follow` | user | Toggle follow → `{ following }` |
| POST | `/videos/:id/like` | user | Toggle like → `{ liked }` |
| POST | `/videos/:id/save` | user | Toggle save → `{ saved }` |
| GET | `/videos/:id/comments` | optional | Visible comments; caller's blocked authors removed |
| POST | `/videos/:id/comments` | user | `{ text }` → new comment (201) |
| POST | `/comments/:id/replies` | user | `{ text }` → new reply; parent reply_count synced |
| POST | `/reports` | user | `{ targetType, targetId, reason, details? }` → creates/attaches to a moderation case; minor_safety escalates to critical |
| POST | `/blocks` | user | `{ blockedProfileId }` → toggle block |
| GET | `/wallet` | user | Wallet (auto-created) + last 50 transactions |
| POST | `/wallet/tip` | user | `{ creatorId, amount, idempotencyKey }`; insufficient balance → 400; duplicate key → no-op success |
| POST | `/wallet/unlock` | user | `{ videoId, idempotencyKey }`; verifies price/entitlement server-side; already-entitled → no double charge |
| GET | `/monetization/packages` | optional | Published catalog + versions + store product mappings (reference prices only) |

### Webhooks

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/revenuecat/webhook` | `Authorization` == `REVENUECAT_WEBHOOK_SECRET` | Stores event idempotently (unique event id); processing pipeline attaches in Batch 13. Unconfigured secret → 401 always |
| POST | `/stripe/webhook` | `stripe-signature` | Signature verification + processing in Batch 15; refuses unsigned calls |

### Admin (requires active admin)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/admin/dashboard` | any admin | Live platform metrics |
| GET | `/admin/moderation` | any admin | Cases + raw reports |
| GET | `/admin/monetization/packages` | any admin | Full catalog incl. drafts |
| POST | `/admin/monetization/package-versions` | superadmin, admin, finance | Creates the next version; **audit-logged** |
| POST | `/admin/payouts/:id/hold` | superadmin, finance | Sets payout `held`, records `payout_holds`; **audit-logged**; paid payouts refuse |
| POST | `/admin/payouts/:id/release` | superadmin, finance | Held → payable, hold released; **audit-logged** |

## Security invariants

1. The service-role Supabase key exists only in this service.
2. Locked/premium content playback URLs are never serialized to clients
   without a server-verified entitlement.
3. Client-side entitlement state is never trusted.
4. Every payout/moderation/pricing mutation writes `audit_logs` (failures
   abort the request).
5. Webhooks refuse unauthenticated calls even when secrets are unset.
