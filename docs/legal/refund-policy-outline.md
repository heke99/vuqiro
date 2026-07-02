# Refund Policy — Outline

> These are product and implementation outlines, not final legal advice.
> Final legal documents must be reviewed by a qualified attorney before launch.

Owner: Diversa Solutions LLC · Product: Vuqiro

## 1. Where purchases happen

All mobile digital purchases (coins, creator subscriptions, boosts) are made
through Apple's App Store or Google Play. **Refunds are requested from and
decided by the store**, per their policies:

- Apple: reportaproblem.apple.com
- Google Play: play.google.com/store/account

Vuqiro cannot directly issue App Store/Google Play refunds.

## 2. What happens after a store refund

When the store notifies us (RevenueCat `REFUND`/`REVOKED` webhooks —
implemented):

- Coin purchases: the coin amount is reversed from the wallet (never below
  zero). Coins already spent are not restored to the spender.
- Subscriptions: the membership ends and membership-derived entitlements are
  revoked.
- The related creator ledger entries are marked `refunded` and excluded from
  payouts.

## 3. Coins, tips and unlocks

Coins have no cash value. Tips and unlocks are final once delivered, except
where required by law or in cases of fraud/unauthorized use — contact
support@vuqiro.app.

## 4. Fraud and abuse

Refund-abuse patterns raise automatic fraud signals (implemented) and can
lead to wallet holds, purchase restrictions or account termination.

## 5. Regional rights

Statutory withdrawal/refund rights (e.g. EU 14-day rules with digital-content
waiver at purchase) are handled by the store checkout flow; counsel to
confirm regional disclosures before launch.

## Implementation status

- [x] Refund webhooks reverse coins and revoke entitlements idempotently
- [x] Ledger exclusion of refunded revenue
- [x] Refund-abuse signals
- [ ] Final policy text with regional disclosures — attorney review
