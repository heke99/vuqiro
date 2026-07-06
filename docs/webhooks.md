# Webhooks

Inbound provider webhooks, their verification and idempotency guarantees.
All handlers live in `apps/api/src/routes/webhooks.ts` and
`apps/api/src/routes/videoWebhooks.ts`.

## RevenueCat — `POST /revenuecat/webhook`

- **Purpose**: coin pack purchases, creator memberships, renewals, refunds.
- **Verification**: the `Authorization` header must equal
  `REVENUECAT_WEBHOOK_SECRET` (configure the same value in the RevenueCat
  dashboard webhook settings).
- **Idempotency**: every event id is recorded in
  `revenuecat_webhook_events.event_id` (unique); replays are acknowledged
  without reprocessing.
- **Effects**: verified purchases upsert `purchases`/`purchase_events`, coins
  credit through the atomic `wallet_credit` function, memberships map through
  the `intended_creator` subscriber attribute; revenue is recorded in the
  ledgers.

## Stripe — `POST /stripe/webhook`

- **Purpose**: creator payout account updates and transfer outcomes
  (Stripe Connect).
- **Verification**: `stripe-signature` HMAC verified with
  `STRIPE_WEBHOOK_SECRET`.
- **Idempotency**: `purchase_events (provider, provider_event_id)` unique.
- **Effects**: payout account status changes, payout state transitions
  (processing → paid/failed) on `creator_payouts`.

## Video provider (Mux) — `POST /video-provider/webhook`

- **Purpose**: upload/processing lifecycle (`video.upload.asset_created`,
  `video.asset.ready`, `video.asset.errored`).
- **Verification**: `mux-signature` HMAC with `VIDEO_WEBHOOK_SECRET`,
  including a 5-minute replay window.
- **Idempotency**: `video_processing_jobs (provider, provider_event_id)`
  unique.
- **Effects**: advances the video state machine
  (`uploading → processing → ready | under_review | rejected`), stores
  playback/thumbnail URLs and durations.

## Operational notes

- Handlers return 2xx for verified duplicates so providers stop retrying.
- Signature failures return 401 and are never processed.
- Webhook secrets are server-only env vars; rotation = update env + provider
  dashboard, no code change.
- Outbound "webhooks": Vuqiro does not currently emit webhooks to third
  parties. Scheduled jobs (`/admin/ops/*/run`, notification job processing)
  are triggered by your scheduler calling admin endpoints with an admin token.
