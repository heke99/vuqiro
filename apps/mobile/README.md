# Vuqiro Mobile

Expo React Native foundation for Vuqiro by Diversa Solutions LLC.

## Run locally

```bash
pnpm install
pnpm dev:mobile
```

Open the QR code with Expo Go for the mock foundation.

For future native purchases/video libraries, use EAS development builds:

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Notes

- Payments are mocked in Batch 1.
- Real RevenueCat integration is scaffolded but not enabled.
- Real upload/video transcoding is not enabled yet.
- Vuqiro uses its own design system and does not copy TikTok branding/UI/assets.
