# Vuqiro Recommendation Engine (V1)

Implemented in `apps/api/src/lib/ranking.ts` (pure, deterministic scoring)
and `apps/api/src/lib/feedRanking.ts` (signal loading + integration into
`GET /feed/for-you`).

## Principles

- **Deterministic**: identical inputs always produce identical ordering
  (stable videoId tie-break, no randomness).
- **Explainable**: every score is a weighted sum of named factors;
  `scoreVideo` returns the full factor breakdown
  (`{name, value, weight, contribution}`), so any ranking decision can be
  audited.
- **Safety first**: unsafe/reported/limited content is structurally
  downranked and paid boosts cannot override it.

## Event tracking

The mobile client buffers all spec events (`app_open` … `admin_action`)
via `trackEvent` and flushes them in batches to `POST /events`, which
validates names against the shared union and writes `video_events`.
Ranking consumes a 7-day window of `video_progress`, `video_complete`,
`video_skip`, `video_rewatch`, and `video_impression` aggregates.

## Factors and weights

| Factor | Weight | Source |
|---|---|---|
| engagement_rate | +25 | likes + 2×comments + 3×saves + 3×shares per view |
| completion_rate | +20 | completes / impressions (7-day events) |
| rewatch_rate | +6 | rewatches / impressions |
| freshness | +18 | exponential decay, ~72h half-life |
| creator_quality | +10 | log follower score + verified bonus + cold-start floor |
| relationship | +12 | viewer follows (+0.6) / subscribes (+0.4) |
| content_match | +6 | category (+0.5) and hashtag (+0.5) match |
| safety | +10 | safety_score / 100 |
| boost | +8 | paid boost, **only** when visible + safety ≥ 80 + zero reports |
| skip_penalty | −10 | skips / impressions |
| report_penalty | −15 | report_count / 5 (capped) |
| spam_penalty | −8 | >50 videos with <2% engagement |

Post-multipliers: `limited` distribution ×0.3, `age_restricted` ×0.6.
Removed/blocked/banned content never reaches ranking (filtered by the feed
rules layer).

## Cold start

Creators with ≤5 videos and <1000 followers receive a +0.35 creator-quality
floor — controlled exposure without letting new content outrank proven
content on quality signals it doesn't have yet.

## Analytics surfaces

- `GET /admin/analytics` (admin): 30-day event counts by name + top videos.
- `GET /creators/me/analytics` (creator, own data only): views, watch-time
  hours, completion rate, followers/subscribers gained, tip/unlock/
  subscription revenue, pending/paid payout amounts.

## Future (V2+) hooks

- Persist per-viewer category/hashtag affinity for the `content_match` factor.
- Move event aggregation into a materialized view / scheduled rollup.
- Replace the lexical safety pre-check with a vendor/ML signal feeding
  `safety_score`.
