# Batch 6 — Discover, search, comments and social UX

Status: complete

## What changed

- **`SocialProvider` session store** (`src/features/social/SocialContext.tsx`)
  holding follows, blocks, likes and saves behind the same interface the real
  backend will use in Batch 10. Blocking a user immediately hides their
  content everywhere (feed, discover, comments) — the UX contract required
  before real moderation.
- **Discover screen completed** per spec: search input; trending creators;
  trending hashtags (watch-count weighted); categories; recommended premium
  creators (monetized, multi-tier, ranked by subscribers); top videos; new
  creators (by join date). Search matches creators (handle/name/category),
  videos (caption/category/hashtags) and hashtags, and excludes blocked
  creators. Every creator row has a working follow/unfollow chip.
- **Comments**: comment sheet now shows Creator/Subscriber badges as real
  badges, reply counts, like (with count), report, and **block commenter**;
  blocked authors' comments (and their replies) disappear immediately.
  Comment submit emits `comment_submit`.
- **Social actions wired end-to-end (mock persistence)**:
  - follow/unfollow — feed item chip, creator profile button, discover rows
  - like/unlike, save/unsave — shared state between feed and detail
  - share — share sheet with copy-link state
  - report — video/comment/profile flows with reason picker
  - block — creator profile (with dedicated blocked-profile screen +
    unblock), comment sheet; settings shows blocked-account count
- **Feed**: Following tab now shows followed creators' videos (verified
  creators as cold-start fallback), and blocked creators are filtered from
  every feed.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # pass
npx expo export --platform web             # bundles cleanly
```

## Acceptance criteria

- [x] discover/search UI works (creators, videos, hashtags)
- [x] comments sheet opens
- [x] replies are visible (with reply counts)
- [x] report comment works as mock flow
- [x] block user works as mock flow (content hidden across app)
- [x] no dead/crashing buttons
