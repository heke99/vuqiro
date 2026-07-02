# Batch 2 — Mobile app foundation (Expo Router)

Status: complete

## What changed

- **Migrated navigation to Expo Router.** Removed the manual state router in
  `App.tsx`; entry is now `expo-router/entry` with the `expo-router` config
  plugin. Route files live in `apps/mobile/app/`.
- **Full route tree** per the product spec:
  - `(public)/` — `welcome`, `sign-in`, `create-account`
  - `(tabs)/` — `feed`, `discover`, `upload`, `inbox`, `wallet`, `profile`
  - `creator/[id]`, `video/[id]`, `settings`
  - `legal/` — `terms`, `privacy`, `community-guidelines`, `creator-terms`, `payout-terms`
  - `modals/` — `subscribe`, `coins`, `report`, `comment-sheet`, `share-sheet`,
    `locked-content` (native modal presentation)
- **New screens:**
  - Sign in (email/password + magic-link entry) and Create account (with
    terms/privacy/guidelines acceptance gate) — mock auth until Batch 7.
  - Discover: search over creators/videos/hashtags, trending creators,
    trending hashtags, categories.
  - Inbox: notification list with per-item and mark-all read state.
  - Video detail: player placeholder, locked-content overlay, creator row,
    stats, inline comments preview.
  - Comment sheet: top-level comments + replies, like/report per comment,
    local add-comment composer.
  - Share sheet, locked-content unlock/subscribe modal, report flow with the
    10 spec report reasons and confirmation state.
  - Settings: legal links, privacy rows, support contact
    (support@vuqiro.app), and a full account-deletion request flow
    (confirm → requested → cancellable).
- **Feed** now has For You / Following mock tabs and routes every action
  (comments, share, report, subscribe, coins, unlock, creator profile, video
  detail) through the router — no dead buttons.
- **Shared types/mocks:** added `Comment`, `NotificationType`,
  `AppNotification` to `@vuqiro/types` and `mockComments`/`mockNotifications`
  to `@vuqiro/mock-data` (expanded further in Batch 3).
- Removed legacy `App.tsx`, `WelcomeScreen`, and the three legacy modal
  components (replaced by modal routes + `ModalShell`).
- ESLint ignores made recursive (`**/.next/**` etc.) so build artifacts in
  workspaces are not linted.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # all pass
npx expo export --platform web             # bundles expo-router entry cleanly
```

## Acceptance criteria

- [x] user can navigate all screens
- [x] Vuqiro branding visible (welcome, settings, legal)
- [x] Diversa Solutions LLC visible in settings/legal
- [x] mock feed visible
- [x] creator profile visible
- [x] wallet visible
- [x] upload scaffold visible
- [x] legal pages visible
- [x] no runtime crash paths (all actions route to real screens/modals)

## Notes / carry-over

- Auth screens are mock-gated; real Supabase auth lands in Batch 7.
- Legal page contents are outlines with in-app disclaimer; finalized in Batch 19.
- Discover gets its full spec treatment in Batch 6; video adapter in Batch 5.
