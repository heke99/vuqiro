# Batch 17 — Notifications

Status: complete

## What changed

- **`notifyProfile` / `notifyCreatorProfile`** (`apps/api/src/lib/notify.ts`):
  the single path for creating notifications, with a type→preference map
  enforced **server-side** before insertion. Payout notifications only ever
  target the owning creator's profile.
- **Backend notification creation wired into every relevant flow**:
  - follow → `new_follower` (to the creator)
  - comment → `new_comment` (to the video's creator, not for self-comments)
  - reply → `comment_reply` (to the parent author, not for self-replies)
  - tip → `coin_received`, unlock → `video_unlocked` (Batch 14, now via the
    shared helper)
  - moderation decision → `moderation_warning` to the affected user with an
    appeal pointer
  - payout batch execution → `payout_status` per creator (paid/processing/
    failed with reason)
- **API endpoints**: `GET /notifications` (own inbox + unread count),
  `POST /notifications/read` (single or all), `GET/POST
  /notifications/preferences` (all seven category toggles + `pushEnabled` +
  `pushToken` storage).
- **Mobile**:
  - Inbox loads real notifications when the API is configured; per-item and
    mark-all-read sync to the backend.
  - New **notification preferences screen** (Settings → Notification
    preferences) with working toggles saved per-change.
- **Push scaffold**: decision doc
  (`docs/architecture/push-notifications.md`) — Expo Notifications chosen
  over raw FCM/APNs, with the client registration flow, server sender plan,
  token storage (`notification_preferences.push_token`) and privacy rules
  (no payout detail in push payloads).

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 112 api tests
```

7 new tests: inbox auth + shape, mark-read validation + all-read,
preferences read, invalid-type rejection, push-token save.

## Acceptance criteria

- [x] backend creates notifications (six event families wired)
- [x] inbox shows real notifications
- [x] user can mark read (single + all, synced)
- [x] preferences are respected (enforced in notifyProfile before insert)
- [x] no notification leaks private payout info to normal users
      (payout notifications target only the owning creator's profile)
