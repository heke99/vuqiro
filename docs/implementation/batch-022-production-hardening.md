# Batch 22 — Production hardening

Status: complete

## What changed

- **Mobile resilience**:
  - Root **error boundary** (Expo Router convention) — unexpected errors show
    a recoverable branded screen and report to monitoring instead of
    crashing.
  - **Monitoring adapter** (`src/services/monitoring.ts`): Sentry activates
    when `EXPO_PUBLIC_SENTRY_DSN` + `@sentry/react-native` exist (EAS
    builds, lazily loaded so Expo Go never crashes); console fallback
    otherwise. Wiring steps documented in the file.
- **API hardening**:
  - Structured JSON request logging (request id, method, path, status,
    duration — explicitly no bodies/tokens/emails/PII), enabled outside
    development.
  - Baseline security headers (nosniff, frame-deny, no-referrer, no-store).
- **Documentation set** (the six spec docs + operations):
  - `docs/testing/production-readiness-checklist.md` — repo-verified items
    vs. credential-blocked vs. operational tasks.
  - `docs/testing/security-checklist.md` — full security review of
    auth/RBAC, RLS, secrets, payment integrity, input handling,
    logging/privacy, with tracked gaps (signed playback tokens, distributed
    rate limiting, CSAM vendor, pen test).
  - `docs/testing/payment-test-plan.md` — 18 sandbox cases including
    duplicate-webhook and refund flows.
  - `docs/testing/moderation-test-plan.md` — 20 cases covering reporting,
    all decisions, appeals, blocking, upload safety.
  - `docs/testing/video-test-plan.md` — pipeline, playback, deletion,
    performance targets.
  - `docs/testing/app-store-test-plan.md` — review-critical paths + platform
    checks per submission.
  - `docs/architecture/operations.md` — deployment topology, backups
    (PITR + weekly dumps + restore drills), monitoring/alerting, and
    incident runbooks (webhook replay, emergency feature flags, payout
    incidents, deletion worker).

Previously-landed hardening is inventoried in the checklists rather than
re-implemented: RBAC, RLS, webhook signatures, idempotency, rate limits,
upload limits, moderation escalation, DB indexes.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 136 tests
npx expo export --platform web             # bundles with error boundary
```

## Acceptance criteria

- [x] no critical security holes known (review documented; gaps tracked with mitigations)
- [x] no duplicate purchase crediting (idempotency layers + tests + DB assertions)
- [x] no client-only paid access (server access check is the only URL source)
- [x] no unmoderated UGC path (pre-check + queue + enforcement)
- [x] no admin route exposed to normal users (RBAC middleware + admin_users gate)
- [x] no secrets in repo
- [x] logs do not leak sensitive info
- [x] backups documented
- [x] monitoring documented
