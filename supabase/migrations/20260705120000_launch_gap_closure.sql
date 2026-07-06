-- Vuqiro launch gap closure — schema completion:
-- mutes, not-interested signals, featured videos, persisted rate-limit events,
-- advertiser self-serve linkage, notification provider message ids, and
-- trigram search indexes.
-- Legal owner: Diversa Solutions LLC

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Mutes (softer than blocks: muted users' content is hidden from the muter,
-- but the muted user can still see/interact with the muter's content)
-- ---------------------------------------------------------------------------

create table public.mutes (
  id uuid primary key default gen_random_uuid(),
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (muter_id, muted_profile_id),
  check (muter_id <> muted_profile_id)
);

create index mutes_muted_idx on public.mutes (muted_profile_id);

-- ---------------------------------------------------------------------------
-- Not-interested signals (negative ranking signal + feed exclusion)
-- ---------------------------------------------------------------------------

create table public.video_not_interested (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, video_id)
);

create index video_not_interested_video_idx on public.video_not_interested (video_id);

-- ---------------------------------------------------------------------------
-- Featured videos (superadmin/admin curation; audited via audit_logs)
-- ---------------------------------------------------------------------------

alter table public.videos
  add column is_featured boolean not null default false,
  add column featured_at timestamptz,
  add column featured_by uuid references public.admin_users (id);

create index videos_featured_idx on public.videos (is_featured, created_at desc)
  where is_featured;

-- ---------------------------------------------------------------------------
-- Rate limit events (persisted violations for ops visibility; the limiter
-- itself stays in-memory per instance)
-- ---------------------------------------------------------------------------

create table public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  limiter_key text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  limit_max integer not null check (limit_max > 0),
  window_ms integer not null check (window_ms > 0),
  created_at timestamptz not null default now()
);

create index rate_limit_events_scope_idx on public.rate_limit_events (scope, created_at desc);
create index rate_limit_events_profile_idx on public.rate_limit_events (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Advertiser self-serve: link an advertiser to the platform user who owns it
-- ---------------------------------------------------------------------------

alter table public.advertisers
  add column owner_profile_id uuid references public.profiles (id) on delete set null;

create index advertisers_owner_idx on public.advertisers (owner_profile_id);

-- ---------------------------------------------------------------------------
-- Notification jobs: provider message id for delivery reconciliation
-- ---------------------------------------------------------------------------

alter table public.notification_jobs
  add column provider_message_id text;

-- ---------------------------------------------------------------------------
-- Trigram indexes for search (ilike on captions, handles, names, tags, titles)
-- ---------------------------------------------------------------------------

create index videos_caption_trgm_idx on public.videos using gin (caption gin_trgm_ops);
create index profiles_handle_trgm_idx on public.profiles using gin (handle gin_trgm_ops);
create index profiles_display_name_trgm_idx on public.profiles using gin (display_name gin_trgm_ops);
create index hashtags_tag_trgm_idx on public.hashtags using gin (tag gin_trgm_ops);
create index sounds_title_trgm_idx on public.sounds using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.mutes enable row level security;
alter table public.video_not_interested enable row level security;
alter table public.rate_limit_events enable row level security;

-- Mutes: private to the muter.
create policy mutes_select_own on public.mutes
  for select using (muter_id = public.current_profile_id());

create policy mutes_insert_own on public.mutes
  for insert with check (public.is_active_user() and muter_id = public.current_profile_id());

create policy mutes_delete_own on public.mutes
  for delete using (muter_id = public.current_profile_id());

-- Not-interested: private to the user who set it.
create policy video_not_interested_select_own on public.video_not_interested
  for select using (profile_id = public.current_profile_id());

create policy video_not_interested_insert_own on public.video_not_interested
  for insert with check (public.is_active_user() and profile_id = public.current_profile_id());

create policy video_not_interested_delete_own on public.video_not_interested
  for delete using (profile_id = public.current_profile_id());

-- Rate limit events: admin reads; service-role writes only.
create policy rate_limit_events_select_admin on public.rate_limit_events
  for select using (public.is_admin());
