# Batch 10 — Real feed, social graph and discovery

Status: complete

## What changed

- **Shared feed query layer** (`apps/api/src/lib/feedQuery.ts`): one
  implementation of the universal visibility rules — only `status=ready`
  with `visible/limited/age_restricted` moderation states and non-private
  visibility are listable; **blocked creators and banned/suspended/deleted
  creator accounts are always removed**; locked content (subscribers/premium/
  coin-unlock) never serializes its playback URL.
- **New feed endpoints**: `GET /feed/hashtag/:tag` (GIN-indexed contains
  query, watch-ranked), `GET /feed/premium` (locked catalog, metadata only),
  plus the existing for-you and following feeds rebuilt on the shared layer.
- **Discovery endpoints**: `GET /search?q=` (creators by handle/name/
  category, videos by caption + hashtag, hashtag suggestions — all rule-
  filtered), `GET /discover/trending` (trending creators with live
  follower/subscriber counts, premium creators, new creators, trending
  hashtags weighted by watch counts, top videos), `GET /creators/:id/videos`
  (public storefront feed).
- **Event ingestion**: `POST /events` — batched (≤100), Zod-validated
  against the full spec event-name union, anonymous or attributed, rate
  limited, writing to `video_events` (the ranking input for Batch 11).
- **Mobile is now backend-driven when configured**:
  - `useFeed` hook loads for-you/following from the API (falls back to mock
    entries on failure — the feed never dies) and `FeedScreen` renders live
    entries; the mock Following logic remains as the offline path.
  - `SocialContext` toggles (follow/block/like/save) fire the corresponding
    API mutations optimistically.
  - A background flusher posts buffered analytics events to `/events` every
    15s with re-buffering on failure.
- Watch events: progress/complete/impression events recorded via the same
  pipeline.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 44 api tests
# live smoke: /discover/trending and /search?q=music return correct payloads
npx expo export --platform web             # bundles cleanly
```

New tests cover: blocked-creator and banned/suspended-creator filtering,
search across the three entity types, empty-query rejection, trending shape,
hashtag feed correctness, premium feed lock invariants, event-name and
batch-size validation.

## Acceptance criteria

- [x] real feed loads from backend (when configured; verified query paths)
- [x] watch events recorded (`/events` → `video_events`)
- [x] follows affect Following feed (server query over `follows`)
- [x] blocks hide users/content (feed rules + comments filter)
- [x] reports create moderation cases (Batch 8 pipeline)
- [x] comments/replies work (Batch 8 endpoints, wired UI)
- [x] likes/saves work (API toggles + optimistic UI)
- [x] search returns real results (DB path implemented; mock parity)
