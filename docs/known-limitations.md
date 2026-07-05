# Known limitations

Deliberate scope boundaries and accepted trade-offs, with the recommended
path when each one starts to matter.

## Infrastructure

- **Single-instance rate limiting.** The limiter is in-memory per API
  instance (violations are persisted for visibility). Horizontal scaling
  needs a shared store (Redis or a Postgres-based limiter).
- **Request-time ranking.** For You ranking aggregates recent events per
  request (bounded queries + rollups exist). At large scale, move candidate
  scoring to precomputed `recommendation_candidates` refreshed by a job.
- **Scheduled jobs are pull-based.** Cron must call the admin ops endpoints;
  there is no built-in scheduler. Missing cron means stale trends/rollups and
  queued notifications (nothing breaks; data lags).
- **In-memory platform-settings cache (30s)** per instance; multi-instance
  deployments converge within the TTL.

## Product

- **Search is substring-based** (trigram-indexed `ilike`), not full-text or
  semantic. Upgrade path: Postgres FTS or an external search service behind
  the same `/search` contract.
- **Messaging is 1:1 text only** — no media, groups, typing indicators or
  read receipts beyond per-conversation `last_read_at`; refresh is 15s
  polling, not sockets. Realtime upgrade path: Supabase Realtime channels.
- **No duet/stitch/remix**, no in-app camera capture or editing — uploads
  come from the media library.
- **Comment threads are one level deep** (replies to replies attach to the
  same parent).
- **Age targeting for ads requires birthdate data** the platform does not
  collect; the ad-group `min_age` field only gates against age-restricted
  contexts.
- **Reach in advertiser analytics is impression-based** (no deduplicated
  cross-device reach estimation).

## Moderation and safety

- **Automated content scanning is rules-based** (keywords, velocity,
  report patterns). No ML/vendor moderation of video frames; the adapter
  seam is `content_safety_signals` (`source = 'model'`) — integrate a vendor
  by writing signals there. **CSAM vendor integration is not implemented**
  and must be addressed before significant scale.
- **Human moderation required.** The queue, appeals and enforcement tools
  are complete, but staffing and SLAs are an owner responsibility.

## Payments and payouts

- **Live provider behavior is untested** without real Mux/RevenueCat/Stripe
  accounts — the adapters follow the public API contracts and are covered by
  unit tests, but a sandbox end-to-end pass is required before launch.
- **Creator payouts assume Stripe Connect availability** in the creator's
  country; tax/KYC handling is delegated to Stripe onboarding.
- **Manual sponsor deals track payment via invoice reference** — there is no
  built-in invoicing; revenue is booked on activation.

## Data

- **Deletion anonymizes rather than hard-deletes**: ledgers, moderation
  history and audit logs are retained (financial/legal records); profile
  identity fields are cleared and content is soft-deleted.
- **Analytics rollups are UTC-day based**; per-timezone reporting is not
  supported.
- **`docs/legal/` content is outline-quality** and requires attorney
  finalization before being published as binding documents.
