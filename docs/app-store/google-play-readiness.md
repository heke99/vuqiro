# Google Play Readiness

App: Vuqiro · Company: Diversa Solutions LLC · Package: `com.diversasolutions.vuqiro`

Legend: ✅ done in repo · 🔑 requires owner account/credentials · ▶ owner action in Play Console

## Identity & assets

- ✅ App icon + adaptive icon (foreground on #07070A): `apps/mobile/assets/`
- ✅ Splash screen wired in `app.json`
- ▶ Feature graphic (1024×500) and phone screenshots (min 2) from a preview build
- ✅ Short description draft: "Short video, made for creators. Watch, discover and support."
- ✅ Full description: reuse the App Store draft

## Data safety form ▶

Declare collection of:

| Data | Purpose | Shared? |
|---|---|---|
| Email address | Account management | No |
| User IDs | App functionality | With payment processors |
| Videos/photos (user content) | App functionality | No |
| Messages (comments) | App functionality | No |
| Purchase history | Payments | RevenueCat/Google |
| App interactions | Analytics, personalization | No |

- Data encrypted in transit: yes. Deletion mechanism: in-app account deletion.
- No data sold; no ads at launch.

## UGC policy compliance ✅ (proof for review)

- Report flows on videos, comments and profiles (10 reason categories)
- Block users; blocked content hidden bidirectionally
- Human moderation queue with removal/limit/age-restrict/suspend/ban
- Appeals; audit-logged actions; community guidelines in-app
- Minor-safety reports auto-escalate to critical

## Payments 🔑

- ▶ Create subscriptions and in-app products with the same product IDs as iOS
- ▶ Connect Play Console to RevenueCat; set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- ▶ License-tester accounts for sandbox purchases

## Other declarations ▶

- Content rating: complete IARC questionnaire (UGC platform → Teen/Mature 17+)
- Target audience: 18+ (or 13+ with the DOB gate added at launch)
- Social features declaration: users can interact (comments), share content
- App access: provide the review test account (docs/app-store/test-accounts.md)

## Submission flow

1. `eas build --profile production --platform android` 🔑
2. `eas submit --platform android` (internal testing track first)
3. Internal testing → closed testing (if desired) → production review
