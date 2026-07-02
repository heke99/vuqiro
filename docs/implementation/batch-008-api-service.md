# Batch 8 — API contracts and backend service layer

Status: complete

## What changed

`apps/api` grew from a health-check shell into the full service layer:

- **Infrastructure** (`src/lib`, `src/middleware`):
  - `supabase.ts` — service-role client (only holder of the service key) and
    anon client for JWT verification; both null-safe in mock mode.
  - `auth.ts` — `attachUser` (JWT → profile), `requireUser` (rejects
    suspended/banned accounts), `requireAdmin(...roles)` (active
    `admin_users` row + role checks). Mock-mode equivalents keep the API
    fully exercisable without credentials.
  - `errors.ts` — typed `ApiError`s mapped to proper HTTP statuses; Zod
    validation errors return structured `400`s.
  - `rateLimit.ts` — fixed-window limiter (follows 60/min, likes 120/min,
    comments 20/min, reports 20/h, blocks 60/h, tips/unlocks 30/min).
  - `audit.ts` — `writeAuditLog` used by every sensitive admin route; write
    failures abort the request.
- **Routes** (all endpoints from the spec plan):
  - `feed` — for-you and following with server-side visibility rules; locked
    content never serializes `playbackUrl`.
  - `creators` — profile + live counts; follow toggle.
  - `videos` — like/save toggles, comment list (blocked authors filtered),
    comment create.
  - `comments` — replies with parent `reply_count` sync.
  - `moderation` — `POST /reports` creates or attaches to moderation cases
    with report-count escalation and automatic critical priority for
    minor-safety; `POST /blocks` toggle with self-block rejection.
  - `wallet` — wallet read (auto-provisioned), tip and unlock with
    server-verified balances/prices, idempotency keys, and duplicate-
    entitlement protection (deepened into atomic Postgres functions in
    Batch 14).
  - `monetization` — published catalog (reference prices only).
  - `webhooks` — RevenueCat endpoint with secret check + idempotent event
    storage (processing lands in Batch 13); Stripe endpoint refusing
    unsigned calls (verification/processing in Batch 15). Both refuse all
    traffic when secrets are unconfigured.
  - `admin` — dashboard metrics, moderation queue, package catalog, price-
    version creation, payout hold/release — all RBAC-gated, all mutations
    audit-logged.
- **Docs**: `docs/architecture/api-contracts.md` — full endpoint table,
  conventions, and security invariants.
- **Tests**: 18 tests covering health, feed visibility (locked content URL
  suppression), auth enforcement, Zod validation, self-block rejection, rate
  limiting (429 after threshold), admin RBAC, audit logging on payout
  hold/release, and webhook secret refusal.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 18 api tests + 15 mock-data tests pass
```

## Acceptance criteria

- [x] service layer exists
- [x] API contracts documented
- [x] endpoint scaffolds or implementation exist (real DB paths for all core routes; webhook processing lands in Batches 13/15 as planned)
- [x] backend types match frontend types (DTOs built from `@vuqiro/types` unions)
