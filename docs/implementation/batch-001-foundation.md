# Batch 1 — Repository repair and foundation

Status: complete

## What changed

- **Fixed the `react-native-web` resolution failure.** Added `react-native-web`,
  `react-dom`, and `@expo/metro-runtime` as direct dependencies of
  `apps/mobile` via `npx expo install`, and added `babel.config.js`
  (`babel-preset-expo`). Verified with a successful `expo export --platform web`
  bundle.
- **Fixed baseline typecheck failure.** TypeScript 6 deprecates `baseUrl`;
  removed it from `tsconfig.base.json` and switched path aliases to relative
  paths.
- **Pinned dependency versions.** Replaced `"latest"` specifiers with the
  resolved versions across all workspaces for reproducible installs.
- **Root scripts** now include `dev:mobile:clear`, `dev:mobile:web`,
  `dev:api`, and `test` per the product spec.
- **New workspaces:**
  - `packages/config` — typed env contract (`loadEnv`, `requireEnv`) with unit tests.
  - `packages/services` — provider adapter interfaces (`VideoProvider`,
    `PaymentsProvider`, `PayoutsProvider`) plus `MockVideoProvider`.
  - `apps/api` — Hono service shell with `/health`, dev script (`tsx watch`), test.
- **`.env.example`** created with the full environment contract (Supabase,
  RevenueCat, Stripe, video provider, observability, public URLs). No secrets.
- **CI** updated: `--frozen-lockfile`, pnpm 9.12.0 pinned, runs lint,
  typecheck, and tests on every push/PR.
- **Vitest** wired into every workspace (`vitest run --passWithNoTests`).
- **EAS config** updated to spec (`cli >= 20.5.0`, `appVersionSource: remote`).
- **Open-source reference script** updated to the clone-or-update contract;
  `.gitignore` now excludes cloned reference repos entirely.
- **Docs:** `docs/implementation/expo-troubleshooting.md`,
  `docs/architecture/decisions.md` (ADRs: Mux, Hono API, Expo Router,
  adapters-with-mocks, Vitest), this report, and `progress.md`.
- `supabase/seed/` directory created.

## Verification

```bash
pnpm install            # clean
pnpm lint               # pass (all workspaces)
pnpm typecheck          # pass (all workspaces)
pnpm test               # pass (config env tests, api health test)
npx expo export --platform web   # bundles without react-native-web error
pnpm dev:admin          # HTTP 200 on http://localhost:3001
pnpm dev:api            # /health returns ok
```

## Acceptance criteria

- [x] no missing react-native-web error
- [x] mobile bundles (web export succeeds; native uses same resolver)
- [x] admin starts
- [x] root scripts work
- [x] CI file exists
- [x] env example exists
- [x] no real secrets committed
- [x] source usage docs exist

## Notes / carry-over

- Expo Router migration is deliberately deferred to Batch 2.
- `packages/services` contains contracts only; real Mux/RevenueCat/Stripe
  implementations arrive in Batches 9, 13, and 15.
