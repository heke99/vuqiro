# Batch 11 — Recommendation engine and analytics

Status: complete

## What changed

- **Deterministic, explainable ranking engine** (`lib/ranking.ts`): weighted
  factors for engagement rate, completion, rewatch, freshness (72h
  half-life), creator quality (with cold-start floor for new creators),
  viewer relationship (follow/subscribe), category/hashtag match, safety
  score, and boost — plus penalties for skips, reports and spam patterns.
  Every score returns its full factor breakdown; ordering is stable with a
  videoId tie-break.
- **Ranking rules enforced structurally**: boosts contribute zero unless the
  video is fully visible, safety ≥ 80 and unreported; `limited` content is
  multiplied ×0.3 and `age_restricted` ×0.6; removed/blocked/banned content
  never reaches the ranker (feed rules filter first).
- **Feed integration** (`lib/feedRanking.ts`): `GET /feed/for-you` now loads
  a 7-day `video_events` aggregate window (progress/completes/skips/
  rewatches/impressions), the viewer's follow + subscription sets, and ranks
  the visible candidate pool before pagination.
- **Analytics surfaces**:
  - `GET /admin/analytics` — 30-day event counts by name + top videos
    (admin-gated).
  - `GET /creators/me/analytics` — the caller's own creator summary (views,
    watch-time, completion rate, followers/subscribers gained, tip/unlock/
    subscription revenue, payout pending/paid) — creators cannot query other
    creators.
- Event tracking end-to-end: mobile buffer → `/events` → `video_events` →
  ranking window (from Batch 10's flusher).
- `docs/architecture/recommendation-engine.md` rewritten with the full
  factor/weight table.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 58 api tests
```

14 new tests: determinism (identical scores, stable ordering, factor
explanations), report/safety/skip downranking, limited suppression,
boost-cannot-bypass-moderation, cold-start floor, spam penalty, relationship
boost, freshness ordering, analytics RBAC.

## Acceptance criteria

- [x] feed ranking is deterministic and explainable
- [x] events are stored (`/events` → `video_events`)
- [x] admin can see basic analytics
- [x] creator can see basic analytics (own data only)
- [x] ranking does not expose removed/banned/blocked content (filtered before ranking)
