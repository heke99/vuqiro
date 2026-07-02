# Batch 21 — EAS builds and internal testing

Status: complete to the credential boundary (builds require owner accounts)

## What changed

- **Native config validated end-to-end without credentials**:
  - `npx expo-doctor`: **20/20 checks pass**. Fixed on the way: missing
    `expo-font` peer (would have crashed dev builds), React version skew
    across workspaces (deduped to 19.2.3 — duplicate native-module versions
    break native builds), `react-native-safe-area-context` aligned to the
    SDK-57 expected version, SDK-57 schema migration (top-level `splash` →
    `expo-splash-screen` plugin config; removed the obsolete
    `newArchEnabled` flag), added `expo-system-ui` for dark
    `userInterfaceStyle` on Android.
  - `npx expo prebuild` for **both platforms** generates clean native
    projects: correct `com.diversasolutions.vuqiro` identifiers, iOS
    permission strings present in `Info.plist`, Android permissions in the
    manifest. Generated `android/`/`ios/` stay out of git (managed
    workflow; gitignored).
- `eas.json` (from Batch 1) re-verified against the spec: dev-client/
  preview/production profiles, `appVersionSource: remote`.
- **`docs/implementation/eas-builds.md`**: one-time owner setup (eas login /
  init / credentials), all six build commands + submit commands, EAS
  environment variable strategy (only `EXPO_PUBLIC_*` in mobile builds), and
  a per-build device validation checklist covering launch, auth, video,
  upload, RevenueCat sandbox, permissions, locked content and deletion.

## Verification

```bash
npx expo-doctor          # 20/20
npx expo prebuild --no-install --platform android   # clean
npx expo prebuild --no-install --platform ios       # clean
pnpm lint && pnpm typecheck && pnpm test            # 136 tests
npx expo export --platform web                      # bundles
```

## Acceptance criteria vs. external dependencies

- [x] EAS config per spec
- [x] native project generation verified (both platforms)
- [x] no config-level crash risks (doctor clean; lazy native-module loading
      for RevenueCat)
- [ ] actual iOS/Android dev/preview/production builds — **require** the
      owner's Expo, Apple Developer and Google Play accounts; exact commands
      and validation steps documented. This is the first item on the
      go-live checklist's external-actions list.
