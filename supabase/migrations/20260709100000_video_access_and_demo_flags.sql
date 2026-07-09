-- Video access control + demo/synthetic data flags.
--
-- 1. Demo/synthetic columns
--    - profiles/videos/creator_memberships: is_demo + seed_batch so seeded
--      demo accounts/content are explicitly marked, excludable in production
--      surfaces and removable by batch with the cleanup script.
--    - video_events/feed_impressions: is_synthetic + seed_batch so seeded
--      metrics never count toward trending, ranking signals, analytics
--      rollups, payouts or ad reporting.
--    All columns are additive with safe defaults; existing rows backfill to
--    is_demo/is_synthetic = false (i.e. real data) automatically.
--
-- 2. Membership-aware SELECT policy on videos
--    The previous videos_select policy exposed every non-private ready row
--    (including playback_url and members-only metadata) to any authenticated
--    user. public.can_view_video() now encodes the same access matrix the
--    API enforces (apps/api/src/lib/videoAccess.ts):
--      - owner and active admins see everything
--      - otherwise the video must be ready + moderation-listable, and
--        - public            -> everyone (incl. anon)
--        - followers_only    -> follower of that creator
--        - subscribers_only /
--          premium_tier_only -> active or grace_period membership for that
--                               exact creator at the required tier or above.
--                               Deliberate business rule: grace_period keeps
--                               access during billing retries; cancelled,
--                               expired and paused do NOT grant access.
--        - unlock_with_coins -> unrevoked per-video entitlement
--        - creator-scoped unrevoked entitlements (admin grants) unlock that
--          creator's gated videos
--        - private           -> owner/admin only

-- ---------------------------------------------------------------------------
-- 1. Demo/synthetic flags
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_demo boolean not null default false,
  add column if not exists seed_batch text;

alter table public.videos
  add column if not exists is_demo boolean not null default false,
  add column if not exists seed_batch text;

alter table public.creator_memberships
  add column if not exists is_demo boolean not null default false,
  add column if not exists seed_batch text;

alter table public.video_events
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists seed_batch text;

alter table public.feed_impressions
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists seed_batch text;

-- Partial indexes: demo/synthetic rows are rare; production queries filter
-- them out, seed cleanup deletes by batch.
create index if not exists profiles_is_demo_idx on public.profiles (is_demo) where is_demo;
create index if not exists videos_is_demo_idx on public.videos (is_demo) where is_demo;
create index if not exists creator_memberships_is_demo_idx on public.creator_memberships (is_demo) where is_demo;
create index if not exists video_events_is_synthetic_idx on public.video_events (is_synthetic) where is_synthetic;
create index if not exists feed_impressions_is_synthetic_idx on public.feed_impressions (is_synthetic) where is_synthetic;
create index if not exists profiles_seed_batch_idx on public.profiles (seed_batch) where seed_batch is not null;
create index if not exists videos_seed_batch_idx on public.videos (seed_batch) where seed_batch is not null;
create index if not exists video_events_seed_batch_idx on public.video_events (seed_batch) where seed_batch is not null;

-- ---------------------------------------------------------------------------
-- 2. Membership-aware video access
-- ---------------------------------------------------------------------------

-- Does the current user hold an access-granting membership for a creator at
-- (or above) the required tier? Only 'active' and 'grace_period' grant
-- access — cancelled/expired/paused never do.
create or replace function public.has_creator_membership(target_creator_id uuid, required_tier text default 'support')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creator_memberships m
    where m.creator_id = target_creator_id
      and m.profile_id = public.current_profile_id()
      and m.status in ('active','grace_period')
      and case coalesce(required_tier, 'support')
            when 'premium' then m.tier = 'premium'
            when 'plus' then m.tier in ('plus','premium')
            else m.tier in ('support','plus','premium')
          end
  );
$$;

-- Central row-level access decision, mirroring the API's canViewVideo().
create or replace function public.can_view_video(video_row public.videos)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.owns_video(video_row)
    or public.is_admin()
    or (
      video_row.status = 'ready'
      and video_row.moderation_status in ('visible','limited','age_restricted')
      and (
        video_row.visibility = 'public'
        or (
          video_row.visibility = 'followers_only'
          and exists (
            select 1 from public.follows f
            where f.creator_id = video_row.creator_id
              and f.follower_id = public.current_profile_id()
          )
        )
        or (
          video_row.visibility in ('subscribers_only','premium_tier_only')
          and public.has_creator_membership(video_row.creator_id, coalesce(video_row.required_tier, 'support'))
        )
        or (
          video_row.visibility = 'unlock_with_coins'
          and exists (
            select 1 from public.creator_membership_entitlements e
            where e.video_id = video_row.id
              and e.profile_id = public.current_profile_id()
              and e.revoked_at is null
          )
        )
        -- Creator-scoped unrevoked entitlements (e.g. admin grants) unlock a
        -- creator's gated (non-private) videos.
        or (
          video_row.visibility <> 'private'
          and exists (
            select 1 from public.creator_membership_entitlements e
            where e.creator_id = video_row.creator_id
              and e.video_id is null
              and e.profile_id = public.current_profile_id()
              and e.revoked_at is null
          )
        )
      )
    );
$$;

drop policy if exists videos_select on public.videos;
create policy videos_select on public.videos
  for select using (public.can_view_video(videos.*));
