# Vuqiro database schema

Canonical schema documentation. Source of truth is `supabase/migrations/` (applied
in filename order); this document summarizes the resulting 92-table schema, the RLS
model and the conventions used. Validate any change with
`bash scripts/validate-migrations.sh` (needs local Postgres) or `supabase db reset`.

## Conventions

- Every public table has **RLS enabled**. The API accesses the database with the
  service role (bypasses RLS) and enforces authorization in route middleware;
  client-side Supabase access gets the minimum policies listed per domain below.
- `set_updated_at()` trigger maintains `updated_at` on mutable tables.
- Ledgers (`coin_transactions`, `creator_revenue_ledger`, `platform_revenue_ledger`,
  `ad_billing_events`, `audit_logs`, `consent_events`) are **append-only**, enforced
  by triggers; corrections are new rows, never updates.
- Idempotency keys guard money movement and webhook processing
  (`coin_transactions.idempotency_key`, `platform_revenue_ledger.idempotency_key`,
  `revenuecat_webhook_events.event_id`, `purchase_events (provider,
  provider_event_id)`, `video_processing_jobs (provider, provider_event_id)`).
- Engagement uniqueness is DB-enforced: `likes (profile_id, video_id)`,
  `saves (profile_id, video_id)`, `follows (follower_id, creator_id)`,
  `blocks (blocker_id, blocked_profile_id)`, `mutes (muter_id, muted_profile_id)`,
  `video_not_interested (profile_id, video_id)`, `comment_likes`, all `unique`.
- Counters on `videos`/`profiles`/`comments` are maintained by triggers
  (like/save/share/comment/follower counts).

## Role helper functions (used by RLS policies)

| Function | Meaning |
|---|---|
| `current_profile_id()` | Profile id of the authenticated user |
| `is_active_user()` | Authenticated and `profiles.status = 'active'` |
| `is_admin()` | Active row in `admin_users` |
| `has_admin_role(text)` | Named role or superadmin |
| `is_superadmin()` / `is_platform_superadmin()` | `platform_superadmin` role |

## Domains

### Identity and account

| Table | Purpose |
|---|---|
| `profiles` | Public identity mapped to `auth.users` (`auth_user_id`); handle, display name, role, status (`active/suspended/banned/deactivated/deleted`), counters. Trigger blocks self role/status escalation. |
| `admin_users` | Console identities: `platform_superadmin`, `admin`, `moderator`, `finance`, `support`; `is_active` gate. |
| `creators` | Creator record per profile: verification, onboarding, monetization enablement, tier config. |
| `creator_profiles` | Storefront presentation (banner tone, headline, links). |
| `profile_settings` | Privacy level, comment/message permissions, personalized-ads opt-in, push enablement. |
| `user_safety_settings` | Restricted mode, comment filter level, blocked keywords, who-can-message. |
| `user_interests` | `(profile_id, interest)` — powers feed personalization and ad targeting. |
| `user_devices` | Install-level device registry. |
| `account_deletion_requests` | 30-day deletion window state machine. |
| `blocks` | Hard block, hides both directions where required. |
| `mutes` | Soft hide: muted users' content is hidden from the muter only. |

### Content

| Table | Purpose |
|---|---|
| `videos` | Core content: caption, hashtags[], category, visibility (`public/followers_only/subscribers_only/premium_tier_only/unlock_with_coins/private`), status (`draft…deleted`), moderation_status (`visible/limited/under_review/removed/blocked/age_restricted/payout_hold`), playback/thumbnail URLs, duration, safety score, engagement counters, `is_featured`/`featured_at`/`featured_by`, monetization fields (`coin_unlock_price`, `required_tier`). |
| `video_assets` | Provider objects (Mux/mock): upload → processing → ready states, renditions. |
| `video_upload_sessions` | Direct-upload session tracking with expiry. |
| `video_processing_jobs` | Webhook-driven processing jobs; idempotent per provider event. |
| `categories`, `hashtags`, `video_hashtags` | Taxonomy. `hashtags.tag` is lowercase-unique with counts. |
| `sounds`, `video_sounds` | Audio references with usage counts. |
| `shares` | Share events with channel. |
| `mentions` | @-mentions on videos/comments. |

### Engagement

`likes`, `saves`, `comments` (threaded via `parent_comment_id`, own moderation
status), `comment_likes`, `follows`, `video_events` (raw client analytics events),
`video_not_interested` (negative feed signal).

### Feed, ranking and analytics

| Table | Purpose |
|---|---|
| `feed_sessions` | Per-user (or anon) feed session envelope by feed type. |
| `feed_impressions` | Item-level delivery: watched_ms, completed, engagement booleans, `skipped_quickly`, position, ad linkage. |
| `recommendation_events` | Ranking decisions (served/skipped/watched/engaged/downranked) with scores. |
| `search_events` | Search log: query, result count, selection. Doubles as recent-search history. |
| `video_analytics_daily`, `creator_analytics_daily` | Daily rollups for dashboards. |
| `trend_snapshots` | Ranked trending entities (hashtag/video/sound/creator) per time window. |
| `boost_campaigns` | Paid promotion of organic videos (coins), delivery counters. |

### Ads

| Table | Purpose |
|---|---|
| `advertisers` | Brand/business record; `owner_profile_id` links to the self-serve platform user; status gates delivery. |
| `ad_accounts` | Billing container with balance. |
| `ad_campaigns` | Objective, buying type (`cpm/cpc/cpa/fixed_sponsorship`), budgets and `spent_cents`, pricing, schedule, status (`draft/pending_review/active/paused/rejected/completed/archived`). |
| `ad_groups` | Placements, targeting jsonb, frequency cap per day. |
| `ad_creatives` | Creative asset + CTA; `review_status` gate. |
| `ad_impressions`, `ad_clicks`, `ad_conversions` | Delivery funnel (impressions require viewability threshold client-side). |
| `ad_frequency_caps` | Per campaign/viewer/day counters. |
| `ad_billing_events` | Append-only charge ledger (CPM/CPC reconciliation). |
| `direct_sponsorship_deals` | Fixed-price manual sponsor deals sold by the platform. |
| `platform_revenue_ledger` | Append-only platform revenue from ads, sponsorships, purchases. |
| `ad_reports` | User reports on served ads. |

### Monetization, wallet and payouts

| Table | Purpose |
|---|---|
| `monetization_packages`, `monetization_package_versions`, `store_products` | Versioned catalog mapped to store SKUs / RevenueCat. |
| `purchases`, `purchase_events`, `revenuecat_webhook_events` | Store-verified purchases with webhook idempotency. |
| `wallets`, `coin_transactions` | Coin balances; mutations only through atomic `wallet_spend`/`wallet_credit`/`wallet_reverse` functions. |
| `creator_memberships`, `creator_membership_entitlements` | Subscriptions and access grants. |
| `creator_revenue_ledger` | Creator earnings with gross/fees/net, estimated vs finalized status, payout linkage. |
| `creator_payout_accounts`, `creator_payouts`, `payout_holds` | Stripe Connect payouts with holds and idempotent transfers. |

### Moderation and safety

`moderation_cases`, `reports`, `moderation_actions`, `appeals`,
`copyright_claims`, `moderation_rules` (automated checks), `content_safety_signals`,
`fraud_signals`, `audit_logs` (append-only admin action trail).

### Privacy and legal

`privacy_requests` (GDPR access/export/deletion), `data_exports` (export jobs with
signed file URLs), `consent_events` (append-only), `legal_documents` (versioned,
published gate), `legal_acceptances`.

### Notifications and messaging

| Table | Purpose |
|---|---|
| `notifications` | In-app inbox. |
| `notification_preferences` | Per-category and per-channel toggles. |
| `push_tokens` | Expo push tokens per device. |
| `notification_jobs` | Outbound queue (push/email) with attempts, `provider_message_id` and status. |
| `conversations`, `conversation_members`, `messages` | Direct/support/system messaging; member-scoped RLS. |

### System and ops

`platform_settings` (key/value jsonb: feed weights, ad frequency, upload limits,
moderation thresholds), `feature_flags` (environment-scoped),
`admin_invitations`, `ops_jobs` (background job queue),
`integration_health_checks`, `support_cases`, `rate_limit_events` (persisted
limiter violations for ops visibility).

## Storage buckets

Created by `20260703150400_vuqiro_99_storage.sql` (skipped on plain Postgres):
`avatars`, `thumbnails`, `ad-creatives`, `report-evidence`, `legal-exports`,
`admin-assets`. Raw video bytes live at the video provider (Mux), not in Supabase
Storage. Bucket policies restrict writes to owners/service role; `legal-exports`
is owner-read via signed URLs only.

## Search indexes

`pg_trgm` GIN indexes support `ilike` search on `videos.caption`,
`profiles.handle`, `profiles.display_name`, `hashtags.tag`, `sounds.title`.
Feed queries use `videos_feed_idx (status, moderation_status, visibility,
created_at desc)`; featured curation uses the partial `videos_featured_idx`.

## Migration list

| File | Contents |
|---|---|
| `20260702100000_core.sql` | Helpers, profiles, admin_users, creators, feature_flags, deletion requests |
| `20260702100100_content.sql` | Videos, assets, events, social graph, comments |
| `20260702100200_moderation.sql` | Moderation, notifications, legal, audit logs |
| `20260702100300_monetization.sql` | Packages, purchases, wallets, memberships, ledgers, payouts |
| `20260702100400_rls.sql` | RLS + policies for the core 37 tables |
| `20260702100500_wallet_functions.sql` | boost_campaigns + atomic wallet functions |
| `20260702100600_fraud_signals.sql` | fraud_signals |
| `20260703150000_vuqiro_99_core_completion.sql` | Taxonomy, sounds, privacy, feed analytics, upload pipeline |
| `20260703150100_vuqiro_99_ads_creator_economy.sql` | Ads platform + revenue ledger |
| `20260703150200_vuqiro_99_safety_ops.sql` | Appeals, copyright, ops, messaging |
| `20260703150300_vuqiro_99_rls_indexes.sql` | RLS + indexes for the 50 new tables |
| `20260703150400_vuqiro_99_storage.sql` | Storage buckets + policies |
| `20260705120000_launch_gap_closure.sql` | Mutes, not-interested, featured, rate_limit_events, advertiser linkage, trigram indexes |
