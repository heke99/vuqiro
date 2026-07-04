-- Vuqiro 99% completion — core: user settings/privacy, content graph
-- (categories, hashtags, sounds, shares, mentions), upload pipeline,
-- feed/analytics tables, profile & video column completion, counter triggers.
-- Legal owner: Diversa Solutions LLC

-- ---------------------------------------------------------------------------
-- Generic append-only guard (used by consent events, revenue ledgers)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_row_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'this table is append-only';
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile completion columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists website_url text,
  add column if not exists country text check (country is null or char_length(country) = 2),
  add column if not exists language text check (language is null or char_length(language) between 2 and 8),
  add column if not exists is_verified boolean not null default false,
  add column if not exists follower_count integer not null default 0 check (follower_count >= 0),
  add column if not exists following_count integer not null default 0 check (following_count >= 0),
  add column if not exists video_count integer not null default 0 check (video_count >= 0),
  add column if not exists like_count bigint not null default 0 check (like_count >= 0),
  add column if not exists last_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- Categories (normalized content taxonomy)
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  label text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index categories_active_idx on public.categories (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Hashtags (normalized; videos.hashtags text[] stays as denormalized cache)
-- ---------------------------------------------------------------------------

create table public.hashtags (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique check (tag = lower(tag) and char_length(tag) between 1 and 80),
  video_count integer not null default 0 check (video_count >= 0),
  view_count bigint not null default 0 check (view_count >= 0),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hashtags_trending_idx on public.hashtags (is_blocked, view_count desc);

create trigger hashtags_updated_at before update on public.hashtags
for each row execute function public.set_updated_at();

create table public.video_hashtags (
  video_id uuid not null references public.videos (id) on delete cascade,
  hashtag_id uuid not null references public.hashtags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, hashtag_id)
);

create index video_hashtags_hashtag_idx on public.video_hashtags (hashtag_id);

-- ---------------------------------------------------------------------------
-- Sounds
-- ---------------------------------------------------------------------------

create table public.sounds (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  artist_name text not null default '',
  audio_url text,
  duration_seconds numeric(8,2) check (duration_seconds is null or duration_seconds > 0),
  source text not null default 'original' check (source in ('original','licensed','library')),
  created_by_creator_id uuid references public.creators (id) on delete set null,
  video_count integer not null default 0 check (video_count >= 0),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sounds_trending_idx on public.sounds (is_blocked, video_count desc);

create trigger sounds_updated_at before update on public.sounds
for each row execute function public.set_updated_at();

create table public.video_sounds (
  video_id uuid not null references public.videos (id) on delete cascade,
  sound_id uuid not null references public.sounds (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, sound_id)
);

create index video_sounds_sound_idx on public.video_sounds (sound_id);

-- ---------------------------------------------------------------------------
-- Video completion columns
-- ---------------------------------------------------------------------------

alter table public.videos
  add column if not exists language text check (language is null or char_length(language) between 2 and 8),
  add column if not exists country text check (country is null or char_length(country) = 2),
  add column if not exists aspect_ratio text,
  add column if not exists completion_rate numeric(5,2) check (completion_rate is null or (completion_rate >= 0 and completion_rate <= 100)),
  add column if not exists ad_eligible boolean not null default true,
  add column if not exists monetization_enabled boolean not null default false,
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists sound_id uuid references public.sounds (id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index videos_category_idx on public.videos (category_id);
create index videos_sound_idx on public.videos (sound_id);
create index videos_country_language_idx on public.videos (country, language);

-- ---------------------------------------------------------------------------
-- Profile settings (privacy & permissions)
-- ---------------------------------------------------------------------------

create table public.profile_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  privacy_level text not null default 'public' check (privacy_level in ('public','followers','private')),
  comment_permission text not null default 'everyone' check (comment_permission in ('everyone','followers','no_one')),
  message_permission text not null default 'followers' check (message_permission in ('everyone','followers','no_one')),
  liked_videos_visibility text not null default 'private' check (liked_videos_visibility in ('public','private')),
  analytics_opt_in boolean not null default true,
  personalized_ads_opt_in boolean not null default false,
  push_enabled boolean not null default false,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger profile_settings_updated_at before update on public.profile_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- User interests (onboarding + recommendations)
-- ---------------------------------------------------------------------------

create table public.user_interests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  interest text not null check (interest ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now(),
  unique (profile_id, interest)
);

create index user_interests_profile_idx on public.user_interests (profile_id);

-- ---------------------------------------------------------------------------
-- User safety settings
-- ---------------------------------------------------------------------------

create table public.user_safety_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  restricted_mode boolean not null default false,
  comment_filter_level text not null default 'standard' check (comment_filter_level in ('off','standard','strict')),
  blocked_keywords text[] not null default '{}',
  who_can_message text not null default 'followers' check (who_can_message in ('everyone','followers','no_one')),
  who_can_mention text not null default 'everyone' check (who_can_mention in ('everyone','followers','no_one')),
  updated_at timestamptz not null default now()
);

create trigger user_safety_settings_updated_at before update on public.user_safety_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Devices & push tokens
-- ---------------------------------------------------------------------------

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  install_id text not null,
  platform text not null check (platform in ('ios','android','web')),
  device_model text not null default '',
  os_version text not null default '',
  app_version text not null default '',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (profile_id, install_id)
);

create index user_devices_profile_idx on public.user_devices (profile_id);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid references public.user_devices (id) on delete set null,
  token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  provider text not null default 'expo' check (provider in ('expo')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_profile_idx on public.push_tokens (profile_id, is_active);

create trigger push_tokens_updated_at before update on public.push_tokens
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privacy requests, data exports, consent events
-- ---------------------------------------------------------------------------

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('access','export','correction','restriction','objection','deletion')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'submitted' check (status in ('submitted','processing','completed','rejected')),
  resolved_by uuid references public.admin_users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index privacy_requests_profile_idx on public.privacy_requests (profile_id, created_at desc);
create index privacy_requests_status_idx on public.privacy_requests (status, created_at desc);

create trigger privacy_requests_updated_at before update on public.privacy_requests
for each row execute function public.set_updated_at();

create table public.data_exports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  privacy_request_id uuid references public.privacy_requests (id) on delete set null,
  status text not null default 'requested' check (status in ('requested','processing','ready','delivered','failed','expired')),
  file_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index data_exports_profile_idx on public.data_exports (profile_id, created_at desc);
create index data_exports_status_idx on public.data_exports (status, created_at desc);

create trigger data_exports_updated_at before update on public.data_exports
for each row execute function public.set_updated_at();

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  consent_type text not null check (consent_type in ('terms','privacy','community_guidelines','creator_terms','payout_terms','personalized_ads','analytics','notifications','marketing')),
  granted boolean not null,
  source text not null default 'settings' check (source in ('onboarding','settings','forced_reacceptance','signup')),
  document_id uuid references public.legal_documents (id) on delete set null,
  created_at timestamptz not null default now()
);

create index consent_events_profile_idx on public.consent_events (profile_id, consent_type, created_at desc);

create trigger consent_events_no_mutation before update or delete on public.consent_events
for each row execute function public.prevent_row_mutation();

-- ---------------------------------------------------------------------------
-- Shares & mentions
-- ---------------------------------------------------------------------------

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  channel text not null default 'system_sheet' check (channel in ('copy_link','system_sheet','direct_message','external')),
  created_at timestamptz not null default now()
);

create index shares_video_idx on public.shares (video_id, created_at desc);
create index shares_profile_idx on public.shares (profile_id);

create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles (id) on delete cascade,
  mentioning_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (video_id is not null or comment_id is not null)
);

create index mentions_mentioned_idx on public.mentions (mentioned_profile_id, created_at desc);
create index mentions_video_idx on public.mentions (video_id);
create index mentions_comment_idx on public.mentions (comment_id);

-- ---------------------------------------------------------------------------
-- Upload pipeline: sessions & processing jobs
-- ---------------------------------------------------------------------------

create table public.video_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  provider text not null default 'mock' check (provider in ('mux','mock')),
  provider_upload_id text,
  upload_url text,
  status text not null default 'created' check (status in ('created','uploading','uploaded','expired','failed','completed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_upload_sessions_video_idx on public.video_upload_sessions (video_id);
create index video_upload_sessions_creator_idx on public.video_upload_sessions (creator_id, created_at desc);
create index video_upload_sessions_status_idx on public.video_upload_sessions (status);

create trigger video_upload_sessions_updated_at before update on public.video_upload_sessions
for each row execute function public.set_updated_at();

create table public.video_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  asset_id uuid references public.video_assets (id) on delete set null,
  provider text not null default 'mock' check (provider in ('mux','mock')),
  provider_event_id text,
  type text not null default 'transcode' check (type in ('transcode','thumbnail','caption','webhook')),
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed')),
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_processing_jobs_video_idx on public.video_processing_jobs (video_id, created_at desc);
create index video_processing_jobs_status_idx on public.video_processing_jobs (status, created_at desc);
-- Webhook idempotency: a provider event may only be processed once.
create unique index video_processing_jobs_event_idx on public.video_processing_jobs (provider, provider_event_id)
  where provider_event_id is not null;

create trigger video_processing_jobs_updated_at before update on public.video_processing_jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Feed sessions & impressions (recommendation signals)
-- ---------------------------------------------------------------------------

create table public.feed_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  anon_session_id text,
  feed_type text not null default 'for_you' check (feed_type in ('for_you','following','trending','hashtag','sound','premium')),
  country text,
  language text,
  app_version text,
  item_count integer not null default 0 check (item_count >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index feed_sessions_profile_idx on public.feed_sessions (profile_id, created_at desc);

create table public.feed_impressions (
  id uuid primary key default gen_random_uuid(),
  feed_session_id uuid references public.feed_sessions (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  anon_session_id text,
  video_id uuid references public.videos (id) on delete cascade,
  -- FK added in the ads migration (ad_creatives is created there).
  ad_creative_id uuid,
  position integer,
  watched_ms integer check (watched_ms is null or watched_ms >= 0),
  completed boolean not null default false,
  liked boolean not null default false,
  commented boolean not null default false,
  shared boolean not null default false,
  saved boolean not null default false,
  followed_creator boolean not null default false,
  skipped_quickly boolean not null default false,
  source text,
  country text,
  language text,
  app_version text,
  created_at timestamptz not null default now(),
  check (video_id is not null or ad_creative_id is not null)
);

create index feed_impressions_profile_idx on public.feed_impressions (profile_id, created_at desc);
create index feed_impressions_video_idx on public.feed_impressions (video_id, created_at desc);
create index feed_impressions_session_idx on public.feed_impressions (feed_session_id);

create table public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  video_id uuid references public.videos (id) on delete cascade,
  event text not null check (event in ('served','skipped','watched','engaged','downranked')),
  score numeric(10,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index recommendation_events_profile_idx on public.recommendation_events (profile_id, created_at desc);
create index recommendation_events_video_idx on public.recommendation_events (video_id, created_at desc);

create table public.search_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  query text not null check (char_length(query) <= 200),
  result_count integer not null default 0 check (result_count >= 0),
  selected_type text check (selected_type in ('video','creator','hashtag','sound')),
  selected_id uuid,
  created_at timestamptz not null default now()
);

create index search_events_profile_idx on public.search_events (profile_id, created_at desc);
create index search_events_created_idx on public.search_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Daily analytics rollups & trend snapshots
-- ---------------------------------------------------------------------------

create table public.video_analytics_daily (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  date date not null,
  views bigint not null default 0 check (views >= 0),
  unique_viewers bigint not null default 0 check (unique_viewers >= 0),
  watch_ms bigint not null default 0 check (watch_ms >= 0),
  completions bigint not null default 0 check (completions >= 0),
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  saves integer not null default 0 check (saves >= 0),
  shares integer not null default 0 check (shares >= 0),
  created_at timestamptz not null default now(),
  unique (video_id, date)
);

create index video_analytics_daily_date_idx on public.video_analytics_daily (date desc);

create table public.creator_analytics_daily (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  date date not null,
  views bigint not null default 0 check (views >= 0),
  watch_ms bigint not null default 0 check (watch_ms >= 0),
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  saves integer not null default 0 check (saves >= 0),
  shares integer not null default 0 check (shares >= 0),
  followers_gained integer not null default 0 check (followers_gained >= 0),
  followers_lost integer not null default 0 check (followers_lost >= 0),
  coins_earned integer not null default 0 check (coins_earned >= 0),
  created_at timestamptz not null default now(),
  unique (creator_id, date)
);

create index creator_analytics_daily_date_idx on public.creator_analytics_daily (date desc);

create table public.trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hashtag','video','sound','creator')),
  reference_id uuid not null,
  rank integer not null check (rank > 0),
  score numeric(12,4) not null default 0,
  time_window text not null default 'daily' check (time_window in ('daily','weekly')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index trend_snapshots_kind_idx on public.trend_snapshots (kind, time_window, captured_at desc);

-- ---------------------------------------------------------------------------
-- Counter maintenance triggers
-- (SECURITY DEFINER so client inserts can update denormalized counts even
--  though RLS blocks direct client updates on the parent rows.)
-- ---------------------------------------------------------------------------

create or replace function public.bump_video_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set like_count = like_count + 1 where id = new.video_id;
    update public.profiles p set like_count = p.like_count + 1
      from public.videos v join public.creators c on c.id = v.creator_id
      where v.id = new.video_id and p.id = c.profile_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.videos set like_count = greatest(like_count - 1, 0) where id = old.video_id;
    update public.profiles p set like_count = greatest(p.like_count - 1, 0)
      from public.videos v join public.creators c on c.id = v.creator_id
      where v.id = old.video_id and p.id = c.profile_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger likes_counter after insert or delete on public.likes
for each row execute function public.bump_video_like_count();

create or replace function public.bump_video_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set save_count = save_count + 1 where id = new.video_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.videos set save_count = greatest(save_count - 1, 0) where id = old.video_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger saves_counter after insert or delete on public.saves
for each row execute function public.bump_video_save_count();

create or replace function public.bump_video_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set comment_count = comment_count + 1 where id = new.video_id;
    if new.parent_comment_id is not null then
      update public.comments set reply_count = reply_count + 1 where id = new.parent_comment_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.videos set comment_count = greatest(comment_count - 1, 0) where id = old.video_id;
    if old.parent_comment_id is not null then
      update public.comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_comment_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger comments_counter after insert or delete on public.comments
for each row execute function public.bump_video_comment_count();

create or replace function public.bump_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger comment_likes_counter after insert or delete on public.comment_likes
for each row execute function public.bump_comment_like_count();

create or replace function public.bump_video_share_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.videos set share_count = share_count + 1 where id = new.video_id;
  return new;
end;
$$;

create trigger shares_counter after insert on public.shares
for each row execute function public.bump_video_share_count();

create or replace function public.bump_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles p set follower_count = p.follower_count + 1
      from public.creators c where c.id = new.creator_id and p.id = c.profile_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles p set follower_count = greatest(p.follower_count - 1, 0)
      from public.creators c where c.id = old.creator_id and p.id = c.profile_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger follows_counter after insert or delete on public.follows
for each row execute function public.bump_follow_counts();

create or replace function public.bump_profile_video_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles p set video_count = p.video_count + 1
      from public.creators c where c.id = new.creator_id and p.id = c.profile_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles p set video_count = greatest(p.video_count - 1, 0)
      from public.creators c where c.id = old.creator_id and p.id = c.profile_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger videos_profile_counter after insert or delete on public.videos
for each row execute function public.bump_profile_video_count();

-- Keep hashtag/sound video counts in sync.
create or replace function public.bump_hashtag_video_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.hashtags set video_count = video_count + 1 where id = new.hashtag_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.hashtags set video_count = greatest(video_count - 1, 0) where id = old.hashtag_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger video_hashtags_counter after insert or delete on public.video_hashtags
for each row execute function public.bump_hashtag_video_count();

create or replace function public.bump_sound_video_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.sounds set video_count = video_count + 1 where id = new.sound_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.sounds set video_count = greatest(video_count - 1, 0) where id = old.sound_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger video_sounds_counter after insert or delete on public.video_sounds
for each row execute function public.bump_sound_video_count();

-- ---------------------------------------------------------------------------
-- New auth users also get default settings rows.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_handle text;
  new_profile_id uuid;
begin
  new_handle := coalesce(
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'handle', split_part(new.email, '@', 1), '')), '[^a-z0-9_.]', '', 'g'), ''),
    'user'
  );
  if exists (select 1 from public.profiles where handle = new_handle) then
    new_handle := left(new_handle, 22) || '_' || substr(md5(random()::text), 1, 6);
  end if;

  insert into public.profiles (auth_user_id, handle, display_name)
  values (new.id, new_handle, coalesce(new.raw_user_meta_data ->> 'display_name', new_handle))
  returning id into new_profile_id;

  insert into public.profile_settings (profile_id) values (new_profile_id)
  on conflict (profile_id) do nothing;
  insert into public.user_safety_settings (profile_id) values (new_profile_id)
  on conflict (profile_id) do nothing;
  insert into public.notification_preferences (profile_id) values (new_profile_id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;
