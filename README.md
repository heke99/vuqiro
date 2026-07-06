# Vuqiro

Vuqiro is a global short-video creator platform by **Diversa Solutions LLC**.

Vuqiro is **not** a TikTok clone. It uses its own name, product identity,
design system, monetization model and architecture.

## What's in this repository

| Path | Description |
|---|---|
| `apps/mobile` | Expo React Native app (Expo Router): onboarding, vertical feed (double-tap like, sound toggle, not-interested/mute, promoted/sponsored labels, accurate watch tracking), live discover/search with recent searches, hashtag feeds, upload, comments with replies + pagination, direct messages, saved/liked/following collections, wallet, creator studio, notifications with deep links, privacy & safety settings, account deletion, legal |
| `apps/admin` | Next.js admin console on live API data with role-based access: dashboard, platform analytics (date filters + CSV), users, creators, videos (+ ranking inspector, feature/unfeature), comments, moderation, reports, appeals, copyright, fraud/safety, full ads suite (advertisers → campaigns → creatives → sponsorships → reporting + CSV exports), monetization + payouts + revenue ledgers, privacy & deletion, legal publishing, feature flags, platform settings (incl. live ranking weights), integration health + ops jobs + rate-limit events, support cases, admin users, audit log — plus a self-serve **advertiser portal** at `/advertiser` |
| `apps/api` | Hono API service: auth/RBAC, feeds & tunable ranking with server-side ad insertion and daily budget pacing, social graph (blocks/mutes/not-interested), video pipeline with optional signed playback, direct messaging, wallet economy, ads serving + CPM/CPC billing, advertiser self-serve, privacy/GDPR workers, RevenueCat/Stripe/Mux webhooks (idempotent), moderation enforcement, notification job runner (push + email), trending + analytics rollup jobs, audit logging |
| `packages/types` | Shared domain model (17 domains incl. ads, privacy, ops) |
| `packages/mock-data` | Deterministic demo data (development/test only; production-gated everywhere) |
| `packages/ui` | Design tokens + admin design-system components |
| `packages/config` | Typed env contract + `assertProductionSafety()` production guard |
| `packages/services` | Provider adapters with health checks: Mux/mock video (+ signed playback), RevenueCat/mock payments, Stripe/mock payouts, Expo/mock push, Resend/mock email |
| `supabase/` | Migrations (92 tables, RLS everywhere, atomic wallet functions, counter triggers, append-only ledgers, reserved-handle guard, storage buckets), seed, CLI config |
| `docs/` | API/database/ads/security/env/deployment/launch docs, architecture, implementation reports, open-source audit, legal, app-store, testing |
| `scripts/` | Migration validation (schema + RLS + wallet + ads + hardening assertions, also in CI), app-asset generation, OSS reference fetching |

**Development runs with zero credentials** — mock providers activate
automatically. Real providers (Supabase, Mux, RevenueCat, Stripe, Expo push,
Sentry) switch on via environment variables (see `.env.example`).
**Production never falls back to mocks**: the API refuses to boot and the
admin console shows a configuration error when providers are missing.

## Quick start

```bash
pnpm install
pnpm dev:mobile        # Expo (QR / simulator); dev:mobile:web for browser
pnpm dev:admin         # http://localhost:3001
pnpm dev:api           # http://localhost:3002/health
```

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test                              # 270+ tests (api + mobile + admin + packages)
pnpm --filter admin build              # Next.js production build
bash scripts/validate-migrations.sh    # schema + RLS + wallet + ads + hardening integrity (needs local Postgres; also runs in CI)
```

## Builds & launch

- Deployment guide: `docs/deployment.md`
- Environment reference: `docs/env.md`
- API reference: `docs/api.md` · Webhooks: `docs/webhooks.md`
- Database schema: `docs/database.md`
- Ads platform: `docs/ads.md` · Creator monetization: `docs/creator-monetization.md`
- Security model: `docs/security.md` · Known limitations: `docs/known-limitations.md`
- Launch gate: `docs/launch-checklist.md` (+ `docs/launch/go-live-checklist.md`)
- Gap-closure status: `docs/launch-readiness/status.md` (audit: `docs/launch-readiness/audit.md`)
- EAS builds: `docs/implementation/eas-builds.md` · Store readiness: `docs/app-store/`

## Open source usage

The full license audit lives in `docs/open-source/oss-intake-report.md`
(approved / reference-only / rejected classification) with aggregated
attributions in `docs/open-source/third-party-notices.md` and `NOTICE.md`.
GPL/AGPL projects are reference-only unless Diversa Solutions LLC makes a
separate written license decision; no copyleft code exists in this repo.
