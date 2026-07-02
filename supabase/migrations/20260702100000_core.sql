-- Vuqiro core schema: extensions, helpers, identity.
-- Legal owner: Diversa Solutions LLC

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by trigger on auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  handle text not null unique check (char_length(handle) between 2 and 30 and handle ~ '^[a-z0-9_.]+$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  role text not null default 'user' check (role in ('user','creator','moderator','admin','platform_superadmin')),
  status text not null default 'active' check (status in ('active','suspended','banned','deletion_requested','deleted')),
  is_creator boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_status_idx on public.profiles (status);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Current caller's profile id (based on Supabase auth.uid()).
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Admin users (separate from consumer roles; the admin app checks this)
-- ---------------------------------------------------------------------------

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'moderator' check (role in ('platform_superadmin','admin','moderator','finance','support')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_users_updated_at before update on public.admin_users
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where auth_user_id = auth.uid() and is_active
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where auth_user_id = auth.uid() and is_active and role = 'platform_superadmin'
  );
$$;

-- Caller has an active (non-suspended, non-banned) profile.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid() and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile + wallet for every new auth user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_handle text;
begin
  new_handle := coalesce(
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'handle', split_part(new.email, '@', 1), '')), '[^a-z0-9_.]', '', 'g'), ''),
    'user'
  );
  -- Ensure uniqueness with a short random suffix on collision.
  if exists (select 1 from public.profiles where handle = new_handle) then
    new_handle := left(new_handle, 22) || '_' || substr(md5(random()::text), 1, 6);
  end if;

  insert into public.profiles (auth_user_id, handle, display_name)
  values (new.id, new_handle, coalesce(new.raw_user_meta_data ->> 'display_name', new_handle));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Creators
-- ---------------------------------------------------------------------------

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  category text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  onboarding_status text not null default 'not_started' check (onboarding_status in ('not_started','in_progress','completed')),
  monetization_enabled boolean not null default false,
  moderation_warnings integer not null default 0 check (moderation_warnings >= 0),
  tiers_enabled text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creators_profile_id_idx on public.creators (profile_id);

create trigger creators_updated_at before update on public.creators
for each row execute function public.set_updated_at();

-- Public storefront settings, editable by the creator.
create table public.creator_profiles (
  creator_id uuid primary key references public.creators (id) on delete cascade,
  banner_tone text not null default 'violet' check (banner_tone in ('violet','cyan','rose','amber','emerald')),
  storefront_headline text not null default '',
  storefront_about text not null default '',
  links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger creator_profiles_updated_at before update on public.creator_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------

create table public.feature_flags (
  key text primary key,
  description text not null default '',
  enabled boolean not null default false,
  environment text not null default 'all' check (environment in ('all','development','preview','production')),
  updated_by uuid references public.admin_users (id),
  updated_at timestamptz not null default now()
);

create trigger feature_flags_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Account deletion requests
-- ---------------------------------------------------------------------------

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  status text not null default 'requested' check (status in ('requested','cancelled','processing','completed')),
  requested_at timestamptz not null default now(),
  complete_by timestamptz not null default now() + interval '30 days',
  processed_at timestamptz
);

create index account_deletion_requests_profile_idx on public.account_deletion_requests (profile_id);
