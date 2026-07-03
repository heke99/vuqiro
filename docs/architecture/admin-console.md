# Vuqiro Admin Console

Next.js App Router console (`apps/admin`, port 3001). All reads and writes go
through the Vuqiro API — the console has no direct table access beyond
Supabase auth (sign-in + `admin_users` gate).

## Data flow

```
page (server component)
  └─ adminApiFetch(path)          lib/adminApi.ts
       └─ Vuqiro API /admin/*     RBAC (requireAdmin) + audit logging
            └─ Supabase (service role) or deterministic mocks (dev only)
```

- `adminApiFetch` sends the signed-in admin's Supabase access token; in
  credential-free development it sends the mock-admin header instead.
- Client mutations use `AdminApiAction` / `AdminForm` /
  `PlatformSettingEditor` — same token handling, `router.refresh()` on
  success, error flashes on failure.

## Mock policy

- Development without Supabase env: the console signs in as a mock superadmin
  and the API serves deterministic fixtures (`source: "mock"`).
- **Production builds refuse mock mode**: without Supabase credentials the
  layout renders a hard configuration-error screen
  (`ADMIN_ALLOW_MOCK=true` is the explicit runtime override for previews).

## RBAC

Role checks live in two layers:

1. **API** — `requireAdmin(...roles)` on every endpoint (the source of truth).
2. **Console** — `lib/rbac.ts` (`canAccessPath`) filters the navigation and
   guards each page (`guardPage`), so operators only see what their role can use.

| Role | Surfaces |
|---|---|
| platform_superadmin | everything, incl. `/admin-users` |
| admin | everything except superadmin-only admin-user management |
| moderator | users/creators (read), videos, comments, moderation, reports, appeals, copyright, fraud |
| finance | monetization suite, payouts, wallet transactions, revenue, ads reporting/billing |
| support | users (read), support cases, privacy requests |

## Page inventory

Dashboard; Users (+detail); Creators; Videos; Comments; Moderation; Reports;
Appeals; Copyright claims; Fraud & safety; Monetization (overview, packages,
price versions, store products, RevenueCat, payouts, wallet transactions,
purchases, revenue ledgers); Ads (overview, advertisers, campaigns, creatives,
sponsorships, reporting); Legal documents; Privacy & deletion; Notifications
(broadcast + push job runner); Feature flags; Platform settings (JSON editor);
Integration health; Support cases; Admin users (+invitations); Audit log;
Store readiness.

Every destructive/sensitive action is RBAC-checked and audit-logged by the
API; the audit trail is immutable (`audit_logs` blocks UPDATE/DELETE).
