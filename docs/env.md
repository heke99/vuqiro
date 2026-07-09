# Environment variables

Single source of truth for configuration. The typed contract lives in
`packages/config/src/env.ts` (`loadEnv()` + `assertProductionSafety()`);
`.env.example` mirrors this file. **Development runs with zero credentials**
(mock providers); **production refuses to boot** when a required provider is
missing.

## Core

| Variable | Required in prod | Purpose |
|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | yes | `development` / `test` / `preview` / `staging` / `production`. Gates mock fallbacks everywhere. |
| `APP_VERSION` | no | Version string surfaced in `/health`. |

## Supabase (database + auth)

| Variable | Required in prod | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Mobile + API auth verification. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Admin console auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | API service-role access. **Server-only — never expose.** |

## Video (Mux)

| Variable | Required in prod | Purpose |
|---|---|---|
| `VIDEO_PROVIDER` | yes (`mux`) | `mux` or `mock`. |
| `VIDEO_PROVIDER_API_KEY` / `VIDEO_PROVIDER_API_SECRET` | yes | Mux API token pair. |
| `VIDEO_WEBHOOK_SECRET` | yes | Mux webhook HMAC verification. |
| `MUX_SIGNING_KEY_ID` / `MUX_SIGNING_PRIVATE_KEY` | optional | Signed playback (expiring stream URLs). Private key = base64 PEM from Mux. |

## Payments (RevenueCat)

| Variable | Required in prod | Purpose |
|---|---|---|
| `REVENUECAT_WEBHOOK_SECRET` | yes | Webhook authorization value. |
| `REVENUECAT_IOS_API_KEY` / `REVENUECAT_ANDROID_API_KEY` | server keys, optional | Server-side RevenueCat calls. |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | yes (mobile builds) | RevenueCat SDK public keys. |

## Payouts (Stripe Connect)

| Variable | Required in prod | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | Stripe API. |
| `STRIPE_WEBHOOK_SECRET` | yes | Webhook signature verification. |
| `STRIPE_CONNECT_CLIENT_ID` | optional | Connect OAuth flows. |

## Push (Expo)

| Variable | Required in prod | Purpose |
|---|---|---|
| `PUSH_PROVIDER` | yes (`expo`) | `expo` or `mock`. |
| `EXPO_ACCESS_TOKEN` | optional | Enhanced-security Expo orgs. |

## Email (Resend)

| Variable | Required in prod | Purpose |
|---|---|---|
| `EMAIL_PROVIDER` | warning if missing | `resend` or `mock`. Missing email is a production warning (in-app + push still work). |
| `RESEND_API_KEY` | with resend | Resend API key. |
| `EMAIL_FROM` | with resend | Verified sender, e.g. `Vuqiro <no-reply@vuqiro.app>`. |

## Monitoring, URLs and networking

| Variable | Required in prod | Purpose |
|---|---|---|
| `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` | warning if missing | Error reporting (API / mobile). |
| `SUPPORT_EMAIL` | defaulted | Support contact surfaced in-app. |
| `PUBLIC_TERMS_URL`, `PUBLIC_PRIVACY_URL`, `PUBLIC_SUPPORT_URL`, `PUBLIC_COMMUNITY_GUIDELINES_URL`, `PUBLIC_CREATOR_TERMS_URL`, `PUBLIC_PAYOUT_TERMS_URL` | yes (store review) | Published legal/support URLs. |
| `API_PORT` / `API_BASE_URL` | defaulted | API listen port / self URL. |
| `CORS_ORIGINS` | yes | Comma-separated browser origin allowlist. Empty in production blocks all browser clients. |
| `ADMIN_URL` | optional | Admin console URL (links). |
| `EXPO_PUBLIC_API_URL` | yes (mobile builds) | Mobile → API base URL. Without it the app runs demo mode (non-production only). |
| `NEXT_PUBLIC_API_URL` | yes (admin deploys) | Admin/advertiser portal → API base URL. |
| `NEXT_PUBLIC_ADMIN_ALLOW_MOCK` / `ADMIN_ALLOW_MOCK` | never in prod | Explicit override to allow admin mock identity (development tooling only). |

## Demo / seed controls (local & staging only)

| Variable | Required in prod | Purpose |
|---|---|---|
| `DEMO_MODE` | never (warning if set) | Keeps demo/seeded (`is_demo`) content visible in feeds/search/trending/rankings. Production without it always excludes demo content and synthetic metrics. |
| `ALLOW_DEMO_SEED` | never | Required (`=true`) to run `pnpm seed:demo-creators`. The seed additionally refuses `NODE_ENV`/`EXPO_PUBLIC_APP_ENV=production`. |
| `ALLOW_DEMO_SEED_REMOTE` | never | Additionally required when the Supabase URL is not local. Staging only — never point the seed at production. |

See `docs/architecture/video-access-control.md` for the full access model
and seed documentation.

## Failure behavior

- `assertProductionSafety()` runs at API boot: in **production**, missing
  Supabase, Mux (+ webhook secret), RevenueCat webhook secret, Stripe or Expo
  push is **fatal** (process exits with the exact list of findings). Missing
  email/Sentry/CORS produce warnings surfaced in `/health`.
- In **staging** everything missing is a warning; development/test/preview run
  fully mocked.
- The admin console blocks with a configuration screen in production when
  Supabase env is absent (no silent mock identity).
- The mobile app gates all demo content on `EXPO_PUBLIC_APP_ENV !== "production"`.
