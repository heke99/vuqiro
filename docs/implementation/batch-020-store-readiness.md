# Batch 20 — App Store and Google Play readiness

Status: complete (store-console actions are owner tasks, fully documented)

## What changed

- **Original app assets generated** from the brand tokens
  (`scripts/generate-app-assets.mjs`, reproducible): 1024px icon, Android
  adaptive-icon foreground, 1284×2778 splash, favicon — the violet Vuqiro
  "V" mark on the dark premium palette, no third-party resemblance.
- **`app.json` completed for submission**: icon/splash/favicon wired, iOS
  permission strings (photo library, camera, microphone),
  `ITSAppUsesNonExemptEncryption=false`, Android media/audio permissions,
  adaptive icon, `expo-video` plugin registered, tablet support off
  (portrait-first product).
- **Four readiness docs** in `docs/app-store/`:
  - `app-store-readiness.md` — full Apple checklist with status legend
    (done-in-repo vs owner console actions), description/keyword drafts,
    privacy-label declarations, IAP setup list with exact product IDs,
    submission flow.
  - `google-play-readiness.md` — Play checklist, complete data-safety form
    table, UGC-policy proof points, IARC guidance, submission flow.
  - `review-notes.md` — copy-paste review notes explaining UGC moderation,
    payments/coins model, restore purchases, account deletion, and locked
    content demo paths.
  - `test-accounts.md` — required review accounts with exact provisioning
    steps (including the atomic wallet-credit call), sandbox tester setup,
    and a no-credentials-in-git policy.

## Verification

```bash
pnpm lint && pnpm typecheck                # pass
npx expo export --platform web            # bundles with new app.json
node scripts/generate-app-assets.mjs      # regenerates assets deterministically
```

## Acceptance criteria vs. external dependencies

- [x] review notes explain UGC moderation
- [x] review notes explain subscriptions/coins
- [x] all required URLs identified (env contract; publishing is an owner action)
- [x] restore purchases visible (Settings)
- [x] account deletion visible (Settings)
- [x] app icon/splash exist and are wired
- [ ] TestFlight / Google internal testing submission — requires Apple
      Developer + Google Play accounts and EAS credentials (Batch 21 covers
      build config; commands documented)
- [ ] screenshots — captured from a preview build once accounts exist
