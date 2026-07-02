# Vuqiro Go-Live Checklist

Final go/no-go gate. Status legend:
✅ complete and verified in this repository ·
🔑 code-complete, blocked on owner accounts/credentials ·
▶ owner/operational action

**Current status: NOT live-ready.** All code batches (1–23) are complete;
every remaining item is an external account, credential, or physical-device
verification listed below.

## Company

- 🔑 Apple Developer account active under Diversa Solutions LLC
- 🔑 Google Play Developer account active
- 🔑 Stripe account active (Connect enabled)
- 🔑 RevenueCat project active (iOS + Android apps, offerings)
- 🔑 Video provider account active (Mux API token + webhook secret)
- ▶ Domain active (vuqiro.app or chosen domain; legal pages published)
- ▶ Support email active (support@vuqiro.app)
- ▶ Trademark checklist completed (docs/legal/trademark-checklist.md)
- ▶ Attorney review of all legal outlines → final published documents

## App

- 🔑 iOS build tested on a physical device (eas-builds.md checklist)
- 🔑 Android build tested on a physical device
- ✅ App icons ready (original Vuqiro mark, wired in app.json)
- 🔑 Screenshots ready (capture from preview build)
- ▶ Privacy policy URL ready → `PUBLIC_PRIVACY_URL`
- ▶ Terms URL ready → `PUBLIC_TERMS_URL`
- ▶ Support URL ready → `PUBLIC_SUPPORT_URL`
- ✅ Account deletion works (in-app request/cancel, backend flow, runbook)
- ✅ Legal acceptances work (signup/creator/payout acceptance stored)

## Payments

- 🔑 Apple IAP products approved (IDs documented in app-store-readiness.md)
- 🔑 Google Play products active
- 🔑 RevenueCat offerings active and mapped
- 🔑 Sandbox tests passed (docs/testing/payment-test-plan.md — 18 cases)
- ✅ Restore purchases implemented and visible (device pass pending 🔑)
- ✅ Refunds/revocations implemented (reversals + entitlement revocation);
  sandbox verification pending 🔑

## Moderation

- ✅ Reports work (video/comment/profile → cases with escalation)
- ✅ Blocks work (hidden everywhere, bidirectional)
- ✅ Remove content works (feed/search disappearance verified by tests)
- ✅ Suspend/ban works (API + RLS enforcement; content blocking on ban)
- ✅ Payout hold works (case-driven + manual, ledger freeze)
- ✅ Audit logs work (append-only; every sensitive action)
- ▶ Moderation staffing/coverage plan for launch

## Video

- ✅ Upload works (mock end-to-end; Mux path implemented) — 🔑 verify with
  Mux credentials on staging
- ✅ Processing works (status machine + signed webhooks)
- ✅ Playback works (expo-video HLS; device pass pending 🔑)
- ✅ Delete/takedown works (provider asset deletion + state clearing)
- 🔑 CDN works (Mux streaming — verified with account)

## Backend

- ✅ Migrations apply cleanly (39 tables; validated with assertions)
- ✅ RLS verified (enabled everywhere; policy matrix documented) — ▶ re-run
  the matrix against the production project
- ✅ Webhooks verified (signature + idempotency tests) — 🔑 live endpoint
  registration
- ▶ Backups configured (PITR + dumps per operations.md)
- ▶ Logs/monitoring configured (drains, uptime, Sentry DSN)

## Launch

- 🔑 TestFlight passed (app-store-test-plan.md)
- 🔑 Google internal testing passed
- ✅ Review notes ready (docs/app-store/review-notes.md)
- ▶ Test accounts provisioned (docs/app-store/test-accounts.md)
- ▶ Production feature flags reviewed (boost_purchases off at launch)
- ▶ Final version tagged (`git tag v1.0.0` after the items above)

## Go / no-go rule

Vuqiro is live-ready **only** when every 🔑 and ▶ above is checked. The
codebase side of every item is complete; no code changes are expected to
close them — only accounts, credentials, published URLs, provisioning and
device verification.
