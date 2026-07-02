# Video Test Plan

Two modes: mock provider (no credentials — CI/local) and Mux (staging 🔑).

## Upload pipeline

| # | Test | Expected |
|---|---|---|
| 1 | Pick a 30s mp4, caption, public | Upload URL issued; file PUTs; status uploading→processing→ready |
| 2 | Status polling from the upload screen | Progresses through the machine; "live-ready" end state |
| 3 | Unsupported format (.avi) | 400 before any upload URL is created |
| 4 | 600 MB file | 400 size limit |
| 5 | >180s video | Client blocks at pick; server enforces duration via provider constraints |
| 6 | unlock_with_coins without price | 400 |
| 7 | Non-creator account uploads | 403 with onboarding hint |
| 8 | Flagged caption | Uploads but ends under_review; not in feed |
| 9 | Mux webhook `video.asset.errored` | Video → rejected; error message stored; upload screen shows failure |
| 10 | Unsigned/stale Mux webhook | 401; no state change |

## Playback

| # | Test | Expected |
|---|---|---|
| 11 | Feed scroll | Exactly one active player; smooth paging; impressions logged |
| 12 | Public video | Plays (HLS via Mux / sample mp4 via mock) |
| 13 | Locked video in feed | No playback URL in payload (verify network tab); lock overlay |
| 14 | Unlock then access | `/videos/:id/access` returns URL; playback works |
| 15 | Playback failure (bad URL) | Mock player fallback; no crash |
| 16 | Watch events | progress/complete events land in video_events |

## Deletion / takedown

| # | Test | Expected |
|---|---|---|
| 17 | Owner deletes from studio | Provider asset deleted; status deleted; gone from feed/search/profile |
| 18 | Moderator removes | Same disappearance; owner notified; appealable |
| 19 | Deleted video direct URL/id | Access check 404 |

## Performance (device, staging)

- Feed scroll at 60fps on a mid-range Android device
- Time-to-first-frame < 2s on Wi-Fi for Mux HLS
- Memory stable over a 10-minute scroll session
