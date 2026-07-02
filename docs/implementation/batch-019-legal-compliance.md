# Batch 19 — Legal, privacy and compliance

Status: complete (attorney review is an owner action)

## What changed

- **Legal document set completed** (all with the required not-legal-advice
  disclaimer): existing outlines (terms, privacy, community guidelines,
  creator terms, payout terms, app-store compliance, source usage, trademark
  checklist) plus new:
  - `copyright-takedown-outline.md` — DMCA notice elements, processing via
    the implemented case pipeline, counter-notice/appeal flow, repeat-
    infringer policy, designated-agent owner action.
  - `refund-policy-outline.md` — store-decided refunds, implemented webhook
    consequences (coin reversal, entitlement revocation, ledger exclusion),
    regional-rights note.
  - `account-deletion-outline.md` — implemented in-app flow, 30-day
    processing runbook, retention exceptions, Apple/Google requirements.
  - `age-rating-and-safety.md` — target ratings (17+ conservative), minimum
    age, implemented UGC safety controls, owner questionnaire actions.
  - `README.md` rewritten as the legal index with the acceptance matrix and
    pre-submission checklist.
- **Acceptance storage implemented end-to-end**:
  - `GET /legal/documents` (latest published per type),
    `POST /legal/accept` (idempotent per profile+document version),
    `GET /legal/acceptances` (own history).
  - Signup now records terms + privacy + community-guidelines acceptance
    server-side; **creator onboarding records creator-terms acceptance**;
    **starting Stripe onboarding records payout-terms acceptance** (the UI
    shows the terms link beside the CTA).
- In-app requirements verified: legal links in settings, terms gate on
  signup, community guidelines visible, reporting/blocking visible, support
  contact visible, account deletion request + cancel working against the
  backend.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 121 api tests
```

5 new tests: published-documents endpoint, accept auth + validation +
recording, acceptance history.

## Acceptance criteria

- [x] all legal pages exist (12 documents)
- [x] user acceptance stored (signup → legal_acceptances)
- [x] creator acceptance stored (onboarding)
- [x] account deletion request works
- [x] support contact visible
- [x] app-store compliance doc exists

## Owner actions before launch

- Attorney review of all outlines; publish final text at public URLs and in
  `legal_documents.content_md`.
- Register the DMCA designated agent.
- Complete the trademark checklist searches.
