# Apple App Store Readiness

App: Vuqiro · Company: Diversa Solutions LLC · Bundle ID: `com.diversasolutions.vuqiro`

Legend: ✅ done in repo · 🔑 requires owner account/credentials · ▶ owner action in App Store Connect

## Identity & assets

- ✅ App icon (1024×1024, original Vuqiro mark): `apps/mobile/assets/icon.png`
- ✅ Splash screen: `apps/mobile/assets/splash.png` (wired in `app.json`)
- ▶ Screenshots: capture from a preview build — 6.7" (1290×2796) and 5.5"
  (1242×2208) sets; suggested scenes: feed, discover, creator profile,
  creator studio, wallet.
- ✅ App name: Vuqiro · Subtitle suggestion: "Short video, made for creators"
- ✅ Description draft (below) · Keywords draft (below)

## Description draft

> Vuqiro is a short-video platform built creator-first. Watch a fast,
> personal feed, discover new creators, and support the ones you love with
> subscriptions and coins. Creators get a full studio: uploads, analytics,
> subscribers, revenue and payouts — everything in one place.

Keywords: `short video,creators,subscriptions,video feed,tips,creator studio`

## URLs (owner: publish and set env)

- ▶ Privacy policy URL → `PUBLIC_PRIVACY_URL`
- ▶ Terms of Use URL → `PUBLIC_TERMS_URL`
- ▶ Support URL → `PUBLIC_SUPPORT_URL` (support@vuqiro.app is shown in-app)

## Review requirements

- ✅ UGC moderation: reporting, blocking, moderation queue, appeals
  (explained in review-notes.md)
- ✅ Account deletion in-app (Settings → Account)
- ✅ Restore purchases visible (Settings → Purchases)
- ✅ Terms acceptance at signup
- ▶ Age rating questionnaire: answer per docs/legal/age-rating-and-safety.md (17+)
- ▶ Privacy nutrition labels — declare: contact info (email), user content
  (videos/comments), identifiers (user ID), usage data (interactions),
  purchases. No tracking across apps; no data sold.

## Payments 🔑

- ▶ Create the subscription group "Creator memberships" with:
  `com.diversasolutions.vuqiro.creator.support.monthly`, `.plus.monthly`, `.premium.monthly`
- ▶ Create consumables: `com.diversasolutions.vuqiro.coins.100/.500/.1200/.5000`
  and boosts `.boost.small/.growth/.launch`
- ▶ Connect App Store Connect to RevenueCat; set
  `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- ▶ Sandbox tester account; run the payment test plan
  (docs/testing/payment-test-plan.md)

## Submission flow

1. `eas build --profile production --platform ios` 🔑 (Apple Developer +
   Expo account)
2. `eas submit --platform ios` or upload via Transporter
3. TestFlight internal testing → review feedback → submit for review with
   review notes + test account (docs/app-store/test-accounts.md)
