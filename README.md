# Vuqiro

Vuqiro is a global short-video creator platform by **Diversa Solutions LLC**.

Vuqiro is **not** a TikTok clone. It uses its own name, product identity,
design system, monetization model and architecture.

## What's in this repository

| Path | Description |
|---|---|
| `apps/mobile` | Expo React Native app (Expo Router): onboarding, vertical feed with sponsored cards, discover, upload, comments, wallet, creator studio, notifications/push, privacy & safety settings, account deletion, legal |
| `apps/admin` | Next.js admin console on live API data with role-based access: dashboard, users, creators, videos, comments, moderation, reports, appeals, copyright, fraud/safety, full ads suite (advertisers → campaigns → creatives → sponsorships → reporting), monetization + payouts + revenue ledgers, privacy & deletion, legal publishing, feature flags, platform settings, integration health, support cases, admin users, audit log |
| `apps/api` | Hono API service: auth/RBAC, feeds & ranking with server-side ad insertion, social graph, video pipeline, wallet economy, ads serving + CPM/CPC billing, privacy/GDPR endpoints, RevenueCat/Stripe/Mux webhooks (idempotent), moderation enforcement, push job runner, audit logging |
| `packages/types` | Shared domain model (17 domains incl. ads, privacy, ops) |
| `packages/mock-data` | Deterministic mock data (development/test only) |
| `packages/ui` | Design tokens + admin design-system components |
| `packages/config` | Typed env contract + `assertProductionSafety()` production guard |
| `packages/services` | Provider adapters with health checks: Mux/mock video, RevenueCat/mock payments, Stripe/mock payouts, Expo/mock push |
| `supabase/` | Migrations (89 tables, RLS everywhere, atomic wallet functions, counter triggers, append-only ledgers, storage buckets), seed, CLI config |
| `docs/` | Architecture, implementation reports, open-source audit, legal, app-store, testing, launch |
| `scripts/` | Migration validation (schema + RLS + wallet + ads assertions), app-asset generation, OSS reference fetching |

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
pnpm test                              # 222 tests (api + mobile + admin + packages)
pnpm --filter admin build              # Next.js production build
bash scripts/validate-migrations.sh    # schema + RLS + wallet + ads integrity (needs local Postgres)
```

## Builds & launch

- EAS builds: `docs/implementation/eas-builds.md`
- Store readiness: `docs/app-store/`
- Test plans: `docs/testing/`
- Go-live gate: `docs/launch/go-live-checklist.md`
- Final report: `docs/implementation/final-build-report.md`

## Open source usage

The full license audit lives in `docs/open-source/oss-intake-report.md`
(approved / reference-only / rejected classification) with aggregated
attributions in `docs/open-source/third-party-notices.md` and `NOTICE.md`.
GPL/AGPL projects are reference-only unless Diversa Solutions LLC makes a
separate written license decision; no copyleft code exists in this repo.
