# Launch checklist

The go/no-go gate for opening Vuqiro to the public. Code-side items are
complete in this repository; owner-side items need accounts, credentials or
review that only Diversa Solutions LLC can provide. The operational deep-dive
lives in `docs/launch/go-live-checklist.md`.

## Code readiness (complete in repo)

- [x] Build, typecheck, lint and all tests green (`pnpm lint && pnpm typecheck && pnpm test && pnpm --filter admin build`)
- [x] Migrations apply cleanly with RLS on every table (`scripts/validate-migrations.sh`, also in CI)
- [x] Production boot guard: missing providers are fatal (`assertProductionSafety`)
- [x] All demo/mock content gated off in production (API, admin, mobile)
- [x] No public admin routes — server-side RBAC on every `/admin/*` endpoint
- [x] Audit logging on all sensitive admin actions
- [x] Webhook signature verification + idempotency (RevenueCat, Stripe, Mux)
- [x] Uploads validated server-side; storage buckets restricted; signed URLs
- [x] Rate limits on auth-adjacent and engagement mutations (+ violation log)
- [x] Error pages / loading states / empty states across apps
- [x] Legal page routes in-app; acceptance tracking
- [x] Env vars documented (`docs/env.md`) with clear failure behavior
- [x] API, database, ads, security, deployment docs

## Owner actions (blocking)

- [ ] Production Supabase project; `supabase db push`; first superadmin row
- [ ] Mux account, API token, webhook secret (optional signing key pair)
- [ ] RevenueCat project, store products/offerings, webhook secret
- [ ] Stripe account with Connect; webhook secret
- [ ] Expo/EAS account; production builds; push credentials
- [ ] Resend account, verified domain, `EMAIL_FROM`
- [ ] Sentry projects (API + mobile)
- [ ] Legal counsel review of `docs/legal/` outlines; publish at the
      `PUBLIC_*_URL` addresses
- [ ] Apple Developer + Google Play accounts; store listings, screenshots,
      privacy labels, UGC declarations (`docs/app-store/`)
- [ ] Configure `CORS_ORIGINS` with the deployed admin origin
- [ ] Schedule the four cron jobs (`docs/deployment.md` §6)
- [ ] Moderation staffing plan + response-time targets
- [ ] Backups (PITR), uptime monitoring, log drains

## Owner actions (strongly recommended before scale)

- [ ] Penetration test / external security review
- [ ] Sandbox end-to-end purchase test on physical iOS + Android devices
- [ ] Stripe Connect payout round-trip in test mode
- [ ] Load test the feed and ad-serving paths
- [ ] Review `docs/known-limitations.md` and accept or schedule each item

## Final smoke test (production)

1. Sign up → onboarding → For You feed plays.
2. Follow, like, comment, save, share, report — all persist.
3. Upload a video → processing → published → appears in feed.
4. Buy coins (sandbox) → tip a creator → ledgers update.
5. Superadmin: enforce content, tune `feed_weights`, create a sponsor deal,
   view analytics, export CSVs.
6. Advertiser portal: draft campaign → submit → admin review → active →
   ad appears in feed with disclosure → impressions/clicks bill correctly.
