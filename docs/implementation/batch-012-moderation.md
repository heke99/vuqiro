# Batch 12 — Real moderation and safety

Status: complete

## What changed

- **Moderation decision pipeline** (`/admin/moderation/cases/:id/decide`,
  moderator+ RBAC): all nine spec actions enforce real state changes —
  - `limit_distribution` / `remove_content` / `age_restrict` /
    `restore_content` mutate the target video/comment moderation status
    (videos also flip `status` between `removed`/`ready`),
  - `suspend_user` / `ban_user` resolve the human behind any target type and
    set `profiles.status`; **banning also blocks all of the user's videos
    and comments platform-wide**,
  - `hold_payout` / `release_payout` resolve the creator, write/release
    `payout_holds`, and flip payouts + ledger entries between held/payable.
  Every decision writes `moderation_actions`, resolves the case, and is
  **audit-logged** (audit failure aborts the action).
- **Case detail endpoint** (`GET /admin/moderation/cases/:id`): case, its
  reports, and its action history. **Reopen** endpoint returns resolved cases
  to review (also audit-logged).
- **Appeals** (`POST /appeals`): owners of moderated content (video, comment,
  profile, creator resolution chain) can appeal a resolved case; the case
  becomes `appealed` and the appeal message attaches to it. Non-owners get
  403; rate limited to 5/day.
- **Enforcement chain already in place from earlier batches, now complete**:
  - reports create/escalate cases with minor-safety auto-critical (Batch 8),
  - banned/suspended users are rejected by `requireUser` and RLS
    `is_active_user()` — they cannot upload, comment, like, follow or report,
  - removed/blocked content is excluded by the feed rules layer and RLS
    select policies,
  - blocked users are hidden client- and server-side.
- **Admin console goes live**: new `AdminApiAction` component calls the real
  API (Supabase session token, `NEXT_PUBLIC_API_URL`) with mock-mode
  fallback. The moderation queue's nine decision buttons and the payout
  hold/release buttons now perform real, audit-logged actions when
  configured.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 68 api tests
```

10 new tests: decision RBAC, invalid-action rejection, resolution + audit
trail, all nine actions accepted, case detail, reopen, appeal auth/
validation/acceptance.

## Acceptance criteria

- [x] report creates moderation case
- [x] admin action changes content/user state
- [x] removed content disappears from feed (feed rules + RLS)
- [x] blocked users are hidden
- [x] payout hold works (case-driven and manual)
- [x] every action has audit log
- [x] banned users cannot upload/comment (API + RLS enforcement)
