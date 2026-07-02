# Vuqiro Video Pipeline

Provider: **Mux** (behind the `VideoProvider` adapter in `packages/services`),
with `MockVideoProvider` for credential-free development. Selection is
environment-driven: `VIDEO_PROVIDER=mux` + `VIDEO_PROVIDER_API_KEY` /
`VIDEO_PROVIDER_API_SECRET` / `VIDEO_WEBHOOK_SECRET`.

## Upload flow (implemented)

1. Client selects a video (`expo-image-picker`, duration pre-checked).
2. `POST /videos/uploads` — API validates:
   - authenticated **active** user with a completed creator record
   - monetization enabled for gated visibilities
   - rate limit (10 uploads/hour/creator)
   - format (`mp4|mov|webm`), size (≤500 MB), caption ≤500 chars, ≤12 hashtags
   - `unlock_with_coins` requires a price
   - **moderation pre-check** on caption/hashtags (flagged → `under_review`)
3. API creates the `videos` row (`status=uploading`) and `video_assets` row
   (`waiting_for_upload`) and returns a Mux direct-upload URL (passthrough =
   Vuqiro video id).
4. Client PUTs the file to the upload URL.
5. Mux transcodes; webhooks advance the status machine:
   - `video.upload.asset_created` → `processing`
   - `video.asset.ready` → playback + thumbnail URLs stored; video becomes
     `ready` unless moderation held it (`under_review` stays)
   - `video.asset.errored` → `rejected` with the error stored
6. `GET /videos/:id/status` — owner-only polling endpoint.
7. `DELETE /videos/:id` — owner deletion: provider asset deleted, video +
   asset marked `deleted`, playback URLs cleared (feed queries only serve
   `status=ready`).

Webhook security: `mux-signature` header verified with HMAC-SHA256 over
`timestamp.rawBody`, constant-time comparison, 5-minute replay window. With
no secret configured, verification always fails (fail-closed) for the Mux
provider; the mock provider accepts local calls by design.

## Status machine

```txt
draft → uploading → uploaded → processing → ready
                                   ↓             ↘
                              under_review → (approve) ready / (reject) removed
processing → rejected (provider error)
any → removed | blocked (moderation) | deleted (owner)
```

## Mock mode

The mock provider returns instantly-ready assets pointing at public sample
streams, and the API finalizes them synchronously, so upload → feed works
end-to-end locally with zero credentials. The mobile Upload screen shows the
full status progression in both modes.

## Not chosen

- Cloudflare Stream / Bunny Stream: viable behind the same interface; Mux won
  on signed playback tokens + webhook ergonomics (see ADR-002).
- Self-hosted FFmpeg: explicitly not a first production choice per spec.
