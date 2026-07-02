# Batch 9 — Real video upload and processing

Status: complete

## What changed

- **Mux provider implementation** (`packages/services/src/video/muxVideoProvider.ts`):
  direct uploads (passthrough carries the Vuqiro video id), asset polling,
  asset deletion, HLS playback + thumbnail URL derivation, and webhook
  signature verification (HMAC-SHA256, constant-time compare, 5-minute
  replay window, fail-closed without a secret).
- **Provider selection** (`getVideoProvider`): `VIDEO_PROVIDER=mux` + creds →
  Mux; otherwise the mock provider (instant-ready assets with public sample
  streams) keeps the entire pipeline working locally.
- **API pipeline** (`apps/api`):
  - `POST /videos/uploads` — the full validation chain from the spec: active
    user, creator onboarding, monetization checks for gated visibility, rate
    limit (10/hour), format/size/caption/hashtag validation,
    coin-price requirement, **moderation pre-check** (lexical screen routing
    flagged uploads to `under_review`), then video + asset records and a
    direct-upload URL. Mock provider finalizes synchronously.
  - `POST /video-provider/webhook` — signature-verified; advances the status
    machine for `asset_created` / `ready` / `errored`, storing playback and
    thumbnail URLs and respecting moderation holds.
  - `GET /videos/:id/status` (owner-only), `DELETE /videos/:id` (owner
    deletion → provider asset delete + `deleted` status, URLs cleared).
- **Mobile upload screen** rebuilt: video picking (`expo-image-picker`) with
  duration guard, caption/hashtags, visibility selector (public/followers/
  subscribers+tier/coin-unlock+price), real API flow (request URL → PUT file →
  poll status) when `EXPO_PUBLIC_API_URL` is set, simulated status machine in
  demo mode, and clear ready/under-review/error end states.
- `docs/architecture/video-pipeline.md` rewritten to match the implementation.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test
# 33 api tests including: upload auth/validation/rate limits, flagged-caption
# review routing, Mux signature accept/tamper/stale/missing-secret cases
npx expo export --platform web   # bundles cleanly
```

## Acceptance criteria

- [x] upload works end-to-end in dev (mock provider synchronous finalize; Mux path implemented for credentials)
- [x] video processing status visible (status endpoint + upload screen states)
- [x] feed can play processed videos (`playback_url` stored on ready)
- [x] deleted/removed videos do not play (URLs cleared; feed filters `status=ready`)
- [x] admin can see video status (videos table shows status/moderation columns)
- [x] upload errors are handled cleanly (rejected status, client error states)

## External setup required (documented, not blocking)

- Mux account: create an API token (`VIDEO_PROVIDER_API_KEY`/`_API_SECRET`),
  a webhook pointing at `POST {API_BASE_URL}/video-provider/webhook`, and set
  `VIDEO_WEBHOOK_SECRET` to the signing secret.
