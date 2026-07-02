# Expo Troubleshooting

Practical fixes for the Vuqiro mobile app (`apps/mobile`, Expo SDK 57, pnpm monorepo).

## Fixing `react-native-web` resolution

Symptom:

```txt
Unable to resolve "react-native-web/dist/exports/AppRegistry"
from expo/src/launch/AppRegistry.ts
```

Cause: Expo's web target needs `react-native-web`, `react-dom`, and
`@expo/metro-runtime` as **direct** dependencies of the app. In a pnpm
monorepo they are not hoisted from transitive dependencies, so Metro cannot
resolve them.

Fix:

```bash
cd apps/mobile
npx expo install react-native-web react-dom @expo/metro-runtime
```

Always use `npx expo install` (not plain `pnpm add`) so versions match the
current Expo SDK. After installing, restart Metro with a cleared cache:

```bash
pnpm dev:mobile:clear
```

`apps/mobile/metro.config.js` is already monorepo-aware: it watches the
workspace root and resolves from both `apps/mobile/node_modules` and the root
`node_modules`. If you add a new workspace package that the mobile app
imports, no Metro change is needed — but you must restart Metro.

## When Expo Go is enough

Expo Go works while the app only uses JS + Expo SDK modules:

- all UI, navigation (Expo Router), mock data
- `expo-video`, `expo-linear-gradient`, `expo-status-bar`, `expo-image-picker`
- Supabase JS client (pure JS)

## When an EAS development build is required

You need a development build (`eas build --profile development`) once the app
uses native modules **outside** the Expo Go runtime:

- `react-native-purchases` (RevenueCat) — no IAP in Expo Go
- push notifications with full APNs/FCM behaviour
- any config-plugin that changes native projects
- Sentry native crash reporting

Rule of thumb: if `npx expo prebuild` output would differ from Expo Go's
runtime, build a dev client.

## Clearing the Metro cache

```bash
pnpm dev:mobile:clear          # expo start --clear
# heavier reset:
rm -rf apps/mobile/.expo apps/mobile/node_modules/.cache
watchman watch-del-all 2>/dev/null || true
```

Clear the cache after: dependency upgrades, babel/metro config changes,
moving files between workspace packages, or "module not found" errors that
persist after install.

## Avoiding native dependency crashes

- Keep every native SDK behind an adapter (`packages/services`) with a mock
  implementation. The app must boot with zero credentials.
- Never call a native module at import time; initialize lazily inside a
  provider/hook and guard with a feature flag or env check.
- Check `npx expo-doctor` before building.
- Match versions with `npx expo install --check`.

## Testing iOS/Android development builds

```bash
# one-time: authenticate
npx eas login

# development client builds
eas build --profile development --platform ios
eas build --profile development --platform android
```

Install the build on a device (QR code from the EAS dashboard), then run
`pnpm dev:mobile` and connect — the dev client replaces Expo Go and includes
your native modules. Use the `preview` profile for shareable internal builds
and `production` for store submissions (see `apps/mobile/eas.json`).
