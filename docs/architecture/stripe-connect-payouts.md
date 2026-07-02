# Stripe Connect Payouts

Stripe Connect is used for creator payouts.

It is not the default checkout for digital purchases inside iOS/Android apps.

## Flow

1. User buys subscription or coins via Apple/Google/RevenueCat.
2. Vuqiro backend receives verified purchase event.
3. Backend creates ledger entries.
4. Ledger calculates creator share, platform fee and payout eligibility.
5. Stripe Connect pays out to the creator.
6. Superadmin can hold or release payouts with audit log.

## Hold reasons

- moderation case
- fraud review
- refund risk
- creator verification missing
- manual admin hold
- legal review
