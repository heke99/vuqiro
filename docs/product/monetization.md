# Vuqiro Monetization Model

Vuqiro monetization has two main tracks:

1. Global creator subscription tiers.
2. Coins/credits for one-time creator support, unlocks and boosts.

## Creator subscription tiers

Global tiers managed by superadmin:

- Creator Support
- Creator Plus
- Creator Premium

Creators can activate available global tiers on their profiles. The platform should not create one App Store / Google Play product per creator in the first version.

## Coins / credits

Default packs:

- 100 Coins
- 500 Coins
- 1,200 Coins
- 5,000 Coins

Coins can be used for:

- tips
- one-time support
- locked video unlocks
- future boosts
- premium creator drops

## Superadmin pricing

Superadmin can change global packages by creating new package versions.

Published versions are immutable. Price changes must create a new version.

Mobile checkout prices must come from App Store / Google Play / RevenueCat, not only from Vuqiro database fields.

## RevenueCat

RevenueCat will manage:

- Apple IAP
- Google Play Billing
- subscriptions
- one-time purchases
- restore purchases
- entitlement state
- webhooks

## Stripe Connect

Stripe Connect will manage creator payouts only.

Apple/Google/RevenueCat collect digital purchases in the mobile app. Vuqiro backend calculates ledger entries and Stripe Connect pays creators.
