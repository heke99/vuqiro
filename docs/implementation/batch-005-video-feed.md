# Batch 5 — Video adapter and feed UX

Status: complete

## What changed

- **Video adapter** in `apps/mobile/src/features/video/`:
  - `videoTypes.ts` — `VideoPlaybackState`, `VideoPlayerProps` (exact spec
    shapes) plus `FeedItemState` covering all 8 feed states.
  - `VideoPlayer.tsx` — adapter component. Real playback uses **expo-video**
    (HLS + MP4, works in Expo Go and dev builds, no crash-prone native
    linking). If no `playbackUrl` exists or playback errors, it degrades to
    the mock player — the app can never crash on video.
  - `MockVideoPlayer.tsx` — simulated 30s playback with progress/completion
    callbacks so watch analytics work without real video.
  - `videoEvents.ts` — buffered analytics tracker (`trackEvent`,
    `drainBufferedEvents`) using the shared `AnalyticsEventName` union
    (feed_view, video_impression, video_play/pause/progress/complete/skip/
    rewatch, likes, comment/share/report opens, creator events, coin events…).
- **Mock playback URLs**: public mock videos now carry public sample MP4
  streams so the dev feed plays real video with zero credentials.
- **FeedItem** now shows the full spec surface: creator avatar, handle,
  verified badge (icon, not text), caption, hashtags, category badge, premium
  badge, locked badge, like/comment/save/share buttons, report action, and a
  support CTA. Likes/saves toggle optimistically and emit events.
- **All 8 feed states rendered**: `public`, `premium`, `subscriber_only`
  (subscribe overlay), `unlock_with_coins` (unlock overlay), `under_review`,
  `removed`, `blocked` (hidden-content overlays; player never receives the
  URL), `age_restricted` (18+ confirmation gate).
- **FeedScreen** uses viewability tracking (60% threshold) to drive exactly
  one active player, `getItemLayout`/`windowSize` tuning for smooth paging,
  and emits `video_impression` per view.
- **Video detail screen** now uses the same `VideoPlayer` adapter.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # pass
npx expo export --platform web             # bundles cleanly with expo-video
```

## Acceptance criteria

- [x] feed works with mock player
- [x] no native-video crash (adapter falls back to mock on any error)
- [x] video adapter exists
- [x] real player pluggable (expo-video active now; Mux HLS URLs drop in via `playbackUrl`)
- [x] all feed actions open correct UI (comments, share, report, subscribe, coins, unlock)

## Notes

- expo-video was chosen over react-native-video for Batch 5 because it works
  inside Expo Go (no EAS build needed for development) and supports HLS on
  both platforms. The adapter interface means react-native-video could be
  substituted later without touching feed code (see references/open-source
  usage notes).
