# Vuqiro

Vuqiro is a global short-video creator platform by **Diversa Solutions LLC**.

Vuqiro is **not** a TikTok clone. It uses its own name, product identity,
design system, monetization model and architecture.

## What's in this repository

| Path | Description |
|---|---|
| `apps/mobile` | Expo React Native app (Expo Router): feed, discover, upload, wallet, creator studio, notifications, settings/legal |
| `apps/admin` | Next.js superadmin console: dashboard, users, creators, videos, comments, moderation, monetization, payouts, legal, feature flags, audit log, fraud/safety, store readiness |
| `apps/api` | Hono API service: auth/RBAC, feeds & ranking, social graph, video pipeline, wallet economy, RevenueCat/Stripe/Mux webhooks, moderation enforcement, notifications, audit logging |
| `packages/types` | Shared domain model (14 domains) |
| `packages/mock-data` | Deterministic mock data (used whenever credentials are absent) |
| `packages/ui` | Design tokens + admin design-system components |
| `packages/config` | Typed environment contract |
| `packages/services` | Provider adapters: Mux/mock video, RevenueCat/mock payments, Stripe/mock payouts |
| `supabase/` | Migrations (39 tables, RLS everywhere, atomic wallet functions), seed, CLI config |
| `docs/` | Architecture, implementation reports (23 batches), legal, app-store, testing, launch |
| `scripts/` | Migration validation, app-asset generation, OSS reference fetching |

**Everything runs with zero credentials** — mock providers activate
automatically. Real providers (Supabase, Mux, RevenueCat, Stripe, Sentry)
switch on via environment variables. See `.env.example`.

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
pnpm test                              # 136 tests
bash scripts/validate-migrations.sh    # schema + RLS + wallet integrity (needs local Postgres)
```

## Builds & launch

- EAS builds: `docs/implementation/eas-builds.md`
- Store readiness: `docs/app-store/`
- Test plans: `docs/testing/`
- Go-live gate: `docs/launch/go-live-checklist.md`
- Final report: `docs/implementation/final-build-report.md`

## Open source usage

Open-source references are documented in `docs/legal/source-usage.md`.
GPL/AGPL projects are reference-only unless Diversa Solutions LLC makes a
separate written license decision. MIT dependencies may be used if documented
and technically appropriate.
