# Legal Notes

These are product and implementation outlines, not final legal advice.
Final legal documents must be reviewed by a qualified attorney before launch.

Legal owner: Diversa Solutions LLC.
Product: Vuqiro.

## Documents

| Document | Outline | In-app | Acceptance stored |
|---|---|---|---|
| Terms of Service | terms-outline.md | /legal/terms | signup (`/legal/accept`) |
| Privacy Policy | privacy-outline.md | /legal/privacy | signup |
| Community Guidelines | community-guidelines-outline.md | /legal/community-guidelines | signup |
| Creator Terms | creator-terms-outline.md | /legal/creator-terms | creator onboarding |
| Payout Terms | payout-terms-outline.md | /legal/payout-terms | Stripe onboarding start |
| Copyright & Takedown | copyright-takedown-outline.md | linked from guidelines | n/a (policy) |
| Refund Policy | refund-policy-outline.md | linked from coins paywall disclaimers | n/a (policy) |
| Account Deletion | account-deletion-outline.md | Settings → Delete account | n/a (flow) |
| Age Rating & Safety | age-rating-and-safety.md | store questionnaires | n/a (internal) |
| App-store compliance | app-store-compliance.md | — | — |
| Source usage (OSS) | source-usage.md | — | — |
| Trademark checklist | trademark-checklist.md | — | — |

## How acceptance works (implemented)

- `legal_documents` stores versioned documents; `legal_acceptances` stores
  per-user acceptance of a specific version (unique per profile+document).
- `POST /legal/accept` records acceptance of the latest published version;
  signup, creator onboarding, and payout onboarding call it automatically.
- The admin console (Platform → Legal) shows document versions and recent
  acceptances; publishing a new version is audit-logged.

## Before submission checklist

- [ ] Attorney review of all outlines → final documents
- [ ] Publish final documents at PUBLIC_*_URL endpoints (web)
- [ ] Load final text into `legal_documents.content_md` and publish
- [ ] Verify acceptance prompts for changed versions
- [ ] Register DMCA designated agent (US Copyright Office)
