# Video access control & demo seed

Vuqiro is **free to watch**: the public feed, public videos, creator
discovery and public profiles never require an account or payment.
Memberships only unlock a specific creator's exclusive (members-only)
content. This document describes the access model, where it is enforced, and
the demo/staging seed system.

## Visibility model

`videos.visibility` (unchanged enum):

| Visibility | Who can view |
|---|---|
| `public` | Everyone, including anonymous viewers |
| `followers_only` | Followers of that creator, owner, admins |
| `subscribers_only` | Members of that exact creator (any tier ≥ `required_tier`), owner, admins — this is the "members-only" tier |
| `premium_tier_only` | Same, but gated on tier rank (`support < plus < premium`) |
| `unlock_with_coins` | Viewers holding an unrevoked per-video coin entitlement, owner, admins |
| `private` | Owner and admins only |

Lifecycle/moderation always applies first: only `status = 'ready'` videos
with `moderation_status IN ('visible','limited','age_restricted')` are
listable for anyone but the owner/admin. Removed/blocked/under-review videos
and content from banned/suspended creators never surface.

### Membership statuses

Only `active` and `grace_period` memberships grant access. `grace_period` is
a **deliberate business rule** (billing retries must not interrupt access).
`cancelled`, `expired` and `paused` never grant access. Membership access is
**creator-specific**: a membership for creator A never unlocks creator B.

## Enforcement layers

1. **Central API service — `apps/api/src/lib/videoAccess.ts`**
   `canViewVideo`, `canGeneratePlaybackUrl`, `canManageVideo`,
   `canModerateVideo`, `getVisibleVideosForViewer`, `loadViewerContext`.
   Every listing surface (for-you, trending, following, hashtag, sound,
   search, discovery, creator profile, video detail) filters rows through
   these rules **before ranking**, so unauthorized videos never enter the
   ranking pipeline or any response. Engagement endpoints (like, save,
   share, comments read/write) require view access; unauthorized gated
   content responds 404 so ids are not probeable.

2. **Hide, don't tease.** Unauthorized members-only/followers-only/private
   videos are omitted entirely — no metadata teaser cards. The only
   deliberate exception is the creator profile endpoint
   (`GET /creators/:id/videos`), which returns:
   - `items`: videos the viewer may watch,
   - `lockedCount`: an aggregate count of gated videos the viewer cannot
     see (no per-video metadata), and
   - `teasers`: sanitized storefront teasers for coin-unlockable videos
     (caption + price only — never playback URLs, thumbnails or asset paths,
     because Mux thumbnail URLs embed the playback id).

3. **Playback URLs.** Gated playback URLs are only ever issued by
   `GET /videos/:id/access` after the central access check. Feed/detail
   DTOs strip `playbackUrl` for anything non-public even for entitled
   viewers. When Mux signing keys are configured, non-public uploads are
   created with a **signed playback policy** and all egress URLs
   (streams + thumbnails) carry short-lived tokens.

4. **Postgres RLS — `public.can_view_video()`**
   (migration `20260709100000_video_access_and_demo_flags.sql`). The
   `videos_select` policy enforces the same matrix for direct table access,
   so anon/authenticated Supabase clients cannot bypass the API. Behavioral
   assertions run in `scripts/validate-migrations.sh`.

## Demo / synthetic data flags

Added columns (all additive, defaulted, safe for existing rows):

- `profiles.is_demo`, `profiles.seed_batch`
- `videos.is_demo`, `videos.seed_batch`
- `creator_memberships.is_demo`, `creator_memberships.seed_batch`
- `video_events.is_synthetic`, `video_events.seed_batch`
- `feed_impressions.is_synthetic`, `feed_impressions.seed_batch`

Exclusion rules:

- Synthetic events/impressions are always excluded from trending
  computation, feed-ranking signals and analytics rollups.
- In production without `DEMO_MODE=true`, all `is_demo` content (videos and
  creators) is excluded from feeds, search, trending and discovery.
- The demo seed never writes monetization tables
  (`creator_revenue_ledger`, `platform_revenue_ledger`, `purchases`,
  payouts, `ad_*`), so demo metrics can never reach creator payouts, ad
  billing or advertiser reporting. This is asserted by tests.

## Demo seed (local/staging only)

```bash
ALLOW_DEMO_SEED=true pnpm seed:demo-creators           # create/refresh
ALLOW_DEMO_SEED=true pnpm seed:demo-creators:cleanup   # remove everything
pnpm test:video-access                                 # access regression suite
```

Guards (all enforced, unit-tested):

- refuses `NODE_ENV=production` or `EXPO_PUBLIC_APP_ENV=production`
- requires `ALLOW_DEMO_SEED=true`
- refuses non-local Supabase URLs unless `ALLOW_DEMO_SEED_REMOTE=true`
  (staging only — never point it at production)
- logs exactly what was created/updated/skipped

What it creates (batch `creator_video_access_test`, all idempotent via
deterministic ids):

- 12 fictional demo creators (`demo_*` handles, `@vuqiro.test` emails,
  invented identities, initials-based avatars, Picsum thumbnails, sample
  Blender/Chromecast/Mux test media) with realistic follower counts
- 10 videos per creator: 7–8 public, 1–2 members-only
  (`subscribers_only`), 1 private — with banded synthetic metrics
  (views 500–250k, plausible like/comment/share ratios)
- test users: `demo_free_viewer`, `demo_member_a` (active membership for
  demo creator A), `demo_member_b` (active membership for demo creator B)
- a small set of `is_synthetic` view events for exclusion testing

Demo sign-in password (local/staging only): `VuqiroDemo!2026`.

Cleanup removes all seeded auth users (cascading to profiles, creators,
videos, memberships, engagement) plus synthetic events/impressions by
`seed_batch`, and never touches non-demo rows — including real accounts that
happen to collide on a handle (those are skipped with a warning at seed
time).

## Manual QA checklist

1. Anonymous: feed loads and plays, creator profiles open, search works, no
   paywall anywhere.
2. `demo_free_viewer`: public playback works; members-only videos absent
   from feed/profile/search; direct detail/access requests 404/403.
3. `demo_member_a`: creator A members-only videos visible and playable via
   the access endpoint; creator B members-only still hidden/blocked.
4. Creator (any `demo_*` creator login): studio lists public/members-only/
   private videos with visibility badges; own profile shows all own videos.
5. Direct API probes for gated/private ids return 404/403 without URLs.
6. Rerun the seed: no duplicates; run cleanup: all demo rows gone.
