# Vuqiro Ads Platform

Native advertising + manually sold company sponsorships. No third-party ad
SDK: ads are first-class rows in the Vuqiro database, served by the API and
rendered as clearly labeled "Sponsored" cards in the mobile feed.

## Domain model

```
advertisers ─┬─ ad_accounts ─── ad_billing_events (append-only)
             └─ ad_campaigns ─┬─ ad_groups ─── ad_creatives
                              ├─ ad_impressions / ad_clicks / ad_conversions
                              ├─ ad_frequency_caps
                              └─ direct_sponsorship_deals
platform_revenue_ledger (append-only; ads + sponsorship + coins + subs)
ad_reports ──► moderation_cases
```

- **Buying types:** `cpm`, `cpc`, `cpa`, `fixed_sponsorship`.
- **Campaign statuses:** `draft → pending_review → active ⇄ paused → completed`, or `rejected`.
- **Placements:** `feed`, `discover`, `profile`, `inbox`, `post_roll`.
- **Creative review:** creatives serve only when `review_status = approved`
  and `status = active`; rejecting a creative pauses it.

## Serving rules (`apps/api/src/lib/adServing.ts`)

An ad is eligible when **all** of the following hold:

1. Campaign `active`, inside its `starts_at`/`ends_at` window, advertiser `active`.
2. Budget not exhausted (`spent_cents < total_budget_cents`) — fixed
   sponsorships are exempt (pre-paid).
3. Ad group `active` and sold for the requested placement.
4. Creative approved + active.
5. Per-viewer per-campaign daily frequency cap not reached
   (`ad_frequency_caps`, keyed by profile id or anonymous session id).
6. Targeting matches: country/language are contextual and always applied;
   **interest targeting is personalization** — viewers who opted out of
   personalized ads (`profile_settings.personalized_ads_opt_in = false`)
   never receive interest-targeted ad groups.

Selection shuffles eligible creatives and prefers distinct campaigns.

## Billing & revenue

- **CPM** — after each impression the API reconciles
  `expected_spend = floor(impressions × cpm_price_cents / 1000)` against
  `spent_cents`; the delta books an `impression_charge` billing event and an
  `ad_revenue` platform-ledger entry (idempotency key `cpm:<campaign>:<spend>`).
- **CPC** — each click books a `click_charge` (idempotency key `cpc:<click id>`).
- **Fixed sponsorships** — activating a deal books the full price as a
  `fixed_fee` billing event and a `sponsorship` platform-ledger entry
  (idempotent per deal). Completing the flight sets the deal `completed`.
- `ad_billing_events` and `platform_revenue_ledger` are append-only
  (DB triggers block UPDATE/DELETE).

## Feed insertion

`GET /feed/for-you` inserts one ad after every `adFrequency` organic videos
(max `maxAdsPerPage` per page), controlled by the `feed` platform setting
(`/admin/platform-settings`). Feed entries are tagged `kind: "video" | "ad"`.
The mobile app renders `SponsoredAdCard` for ad entries: "Sponsored" label,
advertiser name, CTA (logs a click), and a "Report ad" action.

## Manual sponsorship flow (superadmin)

1. `/ads/advertisers` → create the advertiser (the company never logs in) and an ad account.
2. `/ads/campaigns` → create a `fixed_sponsorship` campaign with the agreed price + flight dates.
3. `/ads/creatives` → create an ad group (placement) + creative, then approve the creative.
4. `/ads/sponsorships` → create the deal and **Activate & book revenue**.
5. Activate the campaign; delivery appears under `/ads/reporting`; revenue in
   `/monetization/revenue`.

## Safety

- Users report ads from the feed (`POST /ads/report`) — reports create or
  attach to moderation cases.
- All admin mutations require `platform_superadmin`/`admin` and are
  audit-logged; billing reads additionally allow `finance`.
- RLS: delivery + billing tables are service-role write-only; admin read
  policies (`is_admin()`, finance-scoped for money tables).
