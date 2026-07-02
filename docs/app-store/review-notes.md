# App Review Notes (Apple & Google)

Copy-paste basis for the "Notes for review" fields. Keep updated per release.

---

Vuqiro is a short-video creator platform by Diversa Solutions LLC. Users
watch a vertical video feed, follow and support creators; creators upload
videos and monetize through subscriptions and virtual coins.

## Test account

See the credentials supplied in the review console (reference:
docs/app-store/test-accounts.md). The test account is pre-loaded with coins
and follows several creators so the Following feed, wallet and locked-content
flows are immediately visible.

## User-generated content moderation (UGC)

- Every video, comment and profile has a Report action (10 reason
  categories, including minor safety, which auto-escalates to our highest
  priority queue).
- Users can block any account; blocked users' content is hidden immediately
  and they cannot interact with the blocker.
- A staffed moderation console reviews reports and can limit distribution,
  remove content, age-restrict, suspend or ban accounts. Removed content
  disappears from all feeds instantly. Users are notified of decisions and
  can appeal in-app.
- New uploads pass an automated pre-check; flagged uploads are held for
  human review before appearing in feeds.
- Community Guidelines are available in-app (Settings → Legal) without login.

## Payments

- All digital purchases (creator subscription tiers, coin packs) use
  App Store / Google Play billing via RevenueCat. No external purchase links.
- Prices shown in the paywalls come from the store.
- "Restore purchases" is in Settings → Purchases.
- Coins are consumable virtual currency used to tip creators and unlock
  individual videos. Coins have no cash value and are not withdrawable by
  viewers. Creator earnings are paid out via Stripe Connect outside the app
  (creator payouts are not consumer-facing purchases).
- Refunds are handled by the store; refunded purchases automatically reverse
  coins/subscriptions server-side.

## Account deletion

Settings → Account → Delete account: in-app request with confirmation; data
is removed within 30 days; the request can be cancelled in-app.

## Locked content

Some videos are subscriber-only or coin-unlockable. Access is verified
server-side; the test account includes an active membership and enough coins
to demonstrate both unlock paths.
