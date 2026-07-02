# Account Deletion — Outline

> These are product and implementation outlines, not final legal advice.
> Final legal documents must be reviewed by a qualified attorney before launch.

Owner: Diversa Solutions LLC · Product: Vuqiro

## User-facing flow (implemented)

1. Settings → Account → **Delete account** (required by both app stores).
2. Explicit confirmation of consequences (profile, videos, comments, wallet,
   subscriptions permanently removed).
3. The request is stored in `account_deletion_requests` with a 30-day
   `complete_by` deadline; the profile status becomes `deletion_requested`.
4. The user can cancel from Settings while the request is `requested`.

## Processing (operational runbook)

Within 30 days of an uncancelled request:

- Delete the auth user (cascades to profile, creator, videos, comments,
  wallet, memberships, notifications via FK `on delete cascade`).
- Delete provider-side video assets (Mux) for the creator's videos.
- Anonymize rows that must be retained (see below) rather than deleting.

## Retention exceptions (documented to users in the Privacy Policy)

- Purchase and payout records: retained as required for tax/accounting law.
- Audit logs: retained (append-only) — entries reference IDs, not live PII.
- Moderation records needed for legal compliance (e.g. minor-safety reports).

## Store requirements covered

- Apple 5.1.1(v): in-app account deletion — implemented.
- Google Play account-deletion policy: in-app + the web deletion URL
  (PUBLIC_SUPPORT_URL page) must state the same flow — page content pending
  with the public site.

## Implementation status

- [x] In-app request + cancel flow (real backend writes when configured)
- [x] `account_deletion_requests` table with deadline
- [x] Cascading FK design for hard deletion
- [ ] Scheduled worker executing deletions at `complete_by` — operational
      setup alongside production infrastructure
- [ ] Public web deletion-request page — with the marketing site
