# Batch 18 — Fraud, abuse and safety hardening

Status: complete

## What changed

- **`docs/architecture/abuse-fraud-safety.md`**: full threat catalog (spam
  uploads, bot accounts, fake engagement, payment fraud, refund abuse, payout
  fraud, content scraping, harassment, minor safety, repeat infringers/
  copyright) with implemented mitigations marked and the remaining hardening
  items called out; the complete rate-limit table; the signals pipeline and
  manual review queues.
- **`fraud_signals` table** (migration `20260702100600`): typed signals with
  severity, status, dedupe-friendly indexes, admin-only RLS.
- **Automatic detectors** (`lib/fraudSignals.ts`), deduplicated per open
  type+target:
  - `checkRepeatedReports` — ≥5 distinct reporters on one target within 72h
    → high-severity signal (runs on every report submission).
  - `checkSuspiciousWallet` — purchase/refund alternation within 7 days →
    medium signal (runs on RevenueCat refund webhooks).
  - `checkRapidUploads` — ≥8 uploads/hour → low signal (runs on upload
    requests, alongside the hard 10/hour rate limit).
- **Admin fraud endpoints**: `GET /admin/fraud-signals` (live data) and
  `POST /admin/fraud-signals/:id/resolve` (reviewing/actioned/dismissed,
  audit-logged). The admin fraud-safety dashboard buttons now call the real
  API.
- Already-in-place hardening confirmed and cross-referenced: idempotency
  keys on all payment paths, payout-hold triggers from moderation, rate
  limits on comments/reports/uploads/blocks/tips/boosts/appeals.

## Verification

```bash
bash scripts/validate-migrations.sh        # 39 tables, all RLS
pnpm lint && pnpm typecheck && pnpm test   # 116 api tests
```

## Acceptance criteria

- [x] suspicious activity can be flagged (3 automatic detectors + manual queue)
- [x] payout can be held (moderation-driven + manual, audit-logged)
- [x] repeated abuse creates admin signal (repeated_reports detector)
- [x] rate limits exist for risky actions (10 action classes)
- [x] admin can see fraud/safety warnings (live dashboard + triage actions)
