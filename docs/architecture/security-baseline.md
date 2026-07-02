# Security Baseline

- Never trust client-side entitlement state.
- Purchases must be verified server-side.
- RevenueCat webhooks must be verified.
- Admin routes require role-based access.
- Superadmin actions must be audit logged.
- Payout changes require audit log.
- Content moderation decisions require audit log.
- Avoid leaking private creator payout data to normal users.
- Locked content access must be checked server-side in future backend.
