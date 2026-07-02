# Batch 4 — Admin and superadmin foundation

Status: complete

## What changed

- **Admin design-system components in `packages/ui`** (new `@vuqiro/ui/admin`
  subpath export so React-DOM components never leak into the mobile bundle):
  `AdminPageHeader`, `AdminCard`, `AdminMetricCard`, `AdminStatusBadge`
  (with a status→tone map covering all platform statuses), generic
  `AdminTable`, `AdminSectionHeader`, `AdminEmptyState`.
- **New admin shell:** grouped sidebar (`Overview / Community / Safety /
  Monetization / Platform`) with active-route highlighting, and a topbar
  showing the mock identity — `Logged in as: Superadmin`,
  `Role: platform_superadmin`, `App: Vuqiro`, `Company: Diversa Solutions LLC`.
- **All 19 spec routes implemented** (`/` redirects to `/dashboard`):
  - `/dashboard` — all 15 spec metric cards.
  - `/users` — full column set (id, name, email, status, wallet,
    subscriptions, reports made/against, blocked, created, last active) and
    actions (view profile/wallet/subscriptions/audit log, suspend, ban,
    restore).
  - `/creators` — verification, audience, videos, coin/subscription revenue,
    payout + Stripe status (joined from payout accounts and active holds),
    moderation warnings; verify/unverify, hold/release payouts,
    enable/disable monetization, view content/ledger.
  - `/videos` — caption/creator, visibility, status, moderation status,
    watch/like/comment counts, reports, revenue, created; remove/restore/
    limit/age-restrict/open-reports/open-creator.
  - `/comments` — author, video, text, reports, moderation status; remove/
    restore/hide/ban/open report.
  - `/moderation` — queue stats, case table with all decision actions, and a
    raw recent-reports table.
  - `/monetization` + `packages`, `price-versions`, `store-products`,
    `revenuecat` (SDK/webhook/entitlement state + offerings), `payouts`
    (batch table, hold/release controls, active-holds table).
  - `/notifications`, `/legal` (documents + acceptances), `/feature-flags`,
    `/settings` (identity, upload limits, safety defaults, providers, fees,
    danger zone), `/audit-log`, `/fraud-safety` (signals + metrics),
    `/app-store-readiness` (categorized checklist).
- Actions are `MockAction` client buttons that flash a confirmation; they are
  replaced by real audit-logged API calls in Batches 8/12/15.
- Removed the superseded top-level `/payouts` route (now
  `/monetization/payouts` per spec).

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test    # pass
pnpm dev:admin                              # all 19 routes return HTTP 200
```

## Acceptance criteria

- [x] admin app runs
- [x] all sections visible
- [x] tables use mock data
- [x] actions represented as mock buttons
- [x] audit log exists
- [x] monetization exists (5 subsections)
- [x] moderation exists
- [x] payout controls exist (hold/release/retry + holds table)
