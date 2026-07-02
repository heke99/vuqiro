# Operations: Backups, Monitoring, Deployment

## Deployment topology

- **Mobile**: EAS builds → TestFlight / Play (see eas-builds.md).
- **Admin** (`apps/admin`): Next.js — deploy to Vercel (or any Node host).
  Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_API_URL`.
- **API** (`apps/api`): Node service (`pnpm --filter api start`) — deploy to
  Fly.io/Railway/Render or a container. Env: full server contract from
  `.env.example` (service-role key lives ONLY here).
- **Database/Auth**: Supabase project. Apply migrations with
  `supabase db push` (or the CLI migration flow); seed only non-production.

## Backups

- Enable Supabase **PITR** (Pro plan) — continuous WAL backups.
- Weekly logical dump (`pg_dump`) to external object storage, 90-day
  retention.
- Quarterly restore drill: restore latest dump to a scratch project, run
  `scripts/validate-migrations.sh` sanity checks against it.
- Mux assets are the video source of truth; store provider asset IDs (done)
  so playback can be re-derived; Mux retains masters per plan.

## Monitoring

- **API**: structured JSON logs (request id, status, duration — no PII).
  Ship to the host's log drain. Alert on 5xx rate > 1% and p95 latency.
- **Uptime**: external check on `GET /health` (1-minute interval).
- **Mobile**: Sentry via the monitoring adapter (`EXPO_PUBLIC_SENTRY_DSN`
  + `@sentry/react-native` in EAS builds). Alert on new crash groups.
- **Supabase**: dashboard alerts for connection saturation and disk;
  `get_advisors` security/performance review monthly.
- **Payments**: RevenueCat webhook failure alerts (dashboard) + a daily
  check that `revenuecat_webhook_events.status='error'` is empty.
- **Payouts**: alert when `creator_payouts.status='failed'` rows appear.

## Runbooks

- **Webhook backlog**: replay stored payloads from
  `revenuecat_webhook_events` / `purchase_events` (idempotency makes replays
  safe).
- **Emergency switches**: feature flags `video_upload`, `coin_tips`,
  `creator_subscriptions`, `boost_purchases`, `new_user_signup` (admin →
  Feature flags; changes audit-logged).
- **Payout incident**: hold via admin console (audit-logged), investigate
  ledger, release or reverse.
- **Account deletion worker**: scheduled job (cron/Supabase scheduled
  function) processing `account_deletion_requests` past `complete_by` —
  deletes auth user (cascades) + provider assets.
