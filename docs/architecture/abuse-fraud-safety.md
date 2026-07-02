# Abuse, Fraud & Safety

How Vuqiro protects users, creators and Diversa Solutions LLC. Implemented
controls are marked ✅; planned hardening is marked ▶.

## Threat catalog and mitigations

### Spam uploads
- ✅ Upload rate limit: 10/hour/creator (API) + `rapid_uploads` fraud signal at 8/hour.
- ✅ Moderation pre-check routes flagged captions/hashtags to review before feed eligibility.
- ✅ Ranking spam penalty: high-volume low-engagement creators are downranked.
- ▶ Perceptual-hash duplicate detection on video assets.

### Bot accounts / fake engagement
- ✅ Engagement writes require an authenticated, active account (JWT + RLS `is_active_user`).
- ✅ Like/save (120/min), follow (60/min), comment (20/min) rate limits.
- ✅ `engagement_anomaly` signal type reserved in the schema; ranking uses
  engagement-rate (not raw counts), which dilutes purchased likes.
- ▶ Device/session fingerprinting and per-device rate limits.

### Payment fraud & refund abuse
- ✅ Server is the entitlement authority: RevenueCat webhook (secret-checked,
  event-id idempotent) is the only path that credits coins or activates
  memberships. Duplicate events can never double-credit (3 idempotency layers).
- ✅ Refunds reverse coins atomically (floor at zero) and revoke entitlements.
- ✅ `suspicious_wallet_activity` detector: purchase/refund alternation within
  7 days raises a signal automatically on refund webhooks.
- ✅ All wallet mutations require client idempotency keys.
- ▶ Chargeback-rate thresholds that auto-hold payouts.

### Creator payout fraud
- ✅ Stripe identity verification gates payouts (`payouts_enabled`).
- ✅ Payout holds: 6 typed reasons; severe moderation decisions hold payouts
  and freeze ledger entries; only superadmin/finance can release; all actions
  audit-logged.
- ✅ Payout batches skip held/unverified creators; batch-scoped idempotency
  keys make partial-failure retries safe.
- ✅ Minimum payout threshold ($25) limits micro-fraud churn.

### Content scraping
- ✅ Locked/premium playback URLs are never serialized without a server-side
  entitlement check (`GET /videos/:id/access`).
- ▶ Signed, expiring playback tokens (Mux signed playback policy) for all
  gated content.

### Harassment
- ✅ Reporting on videos, comments and profiles; blocks hide users bidirectionally in feeds/comments.
- ✅ Report → case escalation: 5+ reports raise priority; repeated-reports signal at 5 distinct reporters/72h.
- ✅ Moderation actions: limit/remove/age-restrict/suspend/ban, all audit-logged, all notifying the affected user with appeal rights.

### Minor safety
- ✅ `minor_safety` reports always create critical-priority cases.
- ✅ Age-restriction state with an 18+ gate in the feed.
- ✅ Community Guidelines commit to escalation/reporting to authorities.
- ▶ CSAM hash-matching (e.g. PhotoDNA/vendor) before public availability at scale.

### Repeat infringers / copyright
- ✅ `copyright` report reason feeds the same case pipeline; takedown policy
  doc (Batch 19) defines the counter-notice flow.
- ✅ Moderation warnings counter on creators; bans block all their content.
- ▶ Automated repeat-infringer strike policy.

## Rate limits (per authenticated user)

| Action | Limit |
|---|---|
| Uploads | 10 / hour |
| Comments/replies | 20 / min |
| Likes / saves | 120 / min |
| Follows | 60 / min |
| Reports | 20 / hour |
| Blocks | 60 / hour |
| Tips / unlocks | 30 / min |
| Boosts | 10 / hour |
| Appeals | 5 / day |
| Event batches | 60 / min |

In-memory fixed-window today (single API instance); move the store to
Redis/Postgres when scaling horizontally.

## Signals pipeline

Automatic detectors write to `fraud_signals` (deduplicated per open
type+target): repeated_reports, suspicious_wallet_activity, rapid_uploads.
Admins triage at `/admin/fraud-signals` (dismiss / reviewing / actioned —
audit-logged) and can open moderation cases or hold payouts from the console.

## Manual review queues

- Moderation queue: reports → cases with priority escalation.
- Appeal queue: `appealed` status returns cases to review.
- Fraud queue: open signals ordered by severity.
