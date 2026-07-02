-- Vuqiro content: videos, assets, events, social graph, comments.

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 500),
  hashtags text[] not null default '{}',
  category text,
  visibility text not null default 'public' check (visibility in ('public','followers_only','subscribers_only','premium_tier_only','unlock_with_coins','private')),
  status text not null default 'draft' check (status in ('draft','uploading','uploaded','processing','ready','under_review','rejected','removed','blocked','deleted')),
  moderation_status text not null default 'visible' check (moderation_status in ('visible','limited','under_review','removed','blocked','age_restricted','payout_hold')),
  required_tier text check (required_tier in ('support','plus','premium')),
  coin_unlock_price integer check (coin_unlock_price is null or coin_unlock_price > 0),
  playback_url text,
  thumbnail_url text,
  duration_seconds numeric(8,2),
  safety_score integer not null default 100 check (safety_score between 0 and 100),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  share_count integer not null default 0 check (share_count >= 0),
  save_count integer not null default 0 check (save_count >= 0),
  watch_count bigint not null default 0 check (watch_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- coin-unlock videos must carry a price
  check (visibility <> 'unlock_with_coins' or coin_unlock_price is not null)
);

create index videos_creator_id_idx on public.videos (creator_id);
create index videos_feed_idx on public.videos (status, moderation_status, visibility, created_at desc);
create index videos_hashtags_idx on public.videos using gin (hashtags);

create trigger videos_updated_at before update on public.videos
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Video assets (provider-side objects: uploads, renditions)
-- ---------------------------------------------------------------------------

create table public.video_assets (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  provider text not null default 'mock' check (provider in ('mux','mock')),
  provider_asset_id text,
  provider_upload_id text,
  status text not null default 'waiting_for_upload' check (status in ('waiting_for_upload','processing','ready','errored','deleted')),
  playback_url text,
  thumbnail_url text,
  duration_seconds numeric(8,2),
  aspect_ratio text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_assets_video_id_idx on public.video_assets (video_id);
create unique index video_assets_provider_asset_idx on public.video_assets (provider, provider_asset_id)
  where provider_asset_id is not null;

create trigger video_assets_updated_at before update on public.video_assets
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Video events (watch/engagement analytics; written via API)
-- ---------------------------------------------------------------------------

create table public.video_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  value numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index video_events_video_idx on public.video_events (video_id, name, created_at desc);
create index video_events_profile_idx on public.video_events (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Social graph
-- ---------------------------------------------------------------------------

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, creator_id)
);

create index follows_creator_idx on public.follows (creator_id);

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, video_id)
);

create index likes_video_idx on public.likes (video_id);

create table public.saves (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, video_id)
);

create index saves_video_idx on public.saves (video_id);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_profile_id),
  check (blocker_id <> blocked_profile_id)
);

create index blocks_blocked_idx on public.blocks (blocked_profile_id);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  moderation_status text not null default 'visible' check (moderation_status in ('visible','limited','under_review','removed','blocked','age_restricted','payout_hold')),
  like_count integer not null default 0 check (like_count >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_video_idx on public.comments (video_id, created_at desc);
create index comments_author_idx on public.comments (author_id);
create index comments_parent_idx on public.comments (parent_comment_id);

create trigger comments_updated_at before update on public.comments
for each row execute function public.set_updated_at();

create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, comment_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);
