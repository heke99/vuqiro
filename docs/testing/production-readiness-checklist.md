# Production Readiness Checklist

Status legend: ✅ verified in repo · 🔑 blocked on owner credentials/accounts · ▶ operational task

## Application

- ✅ `pnpm lint`, `pnpm typecheck`, `pnpm test` green (136 tests)
- ✅ Mobile bundles for native + web; expo-doctor 20/20
- ✅ Root error boundary with monitoring capture; video player degrades to
  mock on failure; payments SDK loads lazily (no native-module crashes)
- ✅ All admin routes render; admin actions RBAC-gated + audit-logged
- 🔑 Physical-device test pass (EAS dev build) — see eas-builds.md checklist

## Backend & data

- ✅ 39 tables, RLS enabled on all (asserted by validate-migrations.sh)
- ✅ updated_at triggers, FK indexes, check constraints
- ✅ Atomic wallet functions with DB-level integrity assertions
- ✅ Append-only audit logs
- ▶ Supabase production project: apply migrations, run RLS smoke tests
- ▶ Backups: enable Supabase PITR (Pro plan) + weekly logical dump to
  external storage; document restore drill
- ▶ Monitoring: Supabase log drains + API uptime check + Sentry (DSN in env)

## Security

- ✅ Service-role key only in `apps/api`; clients use anon key under RLS
- ✅ Webhooks fail closed without secrets; signatures verified
  (Mux/Stripe HMAC + replay windows; RevenueCat auth header)
- ✅ Idempotency on all payment/payout mutations
- ✅ Rate limits on 10 risky action classes
- ✅ No secrets in repo (`.env` gitignored; `.env.example` only)
- ✅ Structured API logs without PII; security headers
- See security-checklist.md for the full review

## Payments & payouts

- ✅ Server-side entitlement authority; locked URLs never leak
- 🔑 RevenueCat sandbox test pass (payment-test-plan.md)
- 🔑 Stripe test-mode payout batch run

## Content & moderation

- ✅ Report → case → decision pipeline with enforcement + appeals
- ✅ Upload pre-check; banned users blocked at API + RLS
- ▶ Moderation staffing plan before launch

## Go / no-go

Production launch requires every 🔑/▶ item closed. Tracked in
docs/launch/go-live-checklist.md.
