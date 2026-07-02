-- Vuqiro foundation schema draft
-- Legal owner: Diversa Solutions LLC
-- This migration is a planning foundation and should be reviewed before production.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  handle text unique not null,
  display_name text not null,
  bio text,
  status text not null default 'active' check (status in ('active','suspended','banned','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  stripe_connect_status text not null default 'not_started',
  payout_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id),
  caption text not null default '',
  visibility text not null default 'public',
  moderation_status text not null default 'under_review',
  required_tier text,
  coin_unlock_price integer,
  playback_url text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monetization_packages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  type text not null check (type in ('creator_subscription_tier','coin_pack','boost_pack','platform_premium')),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monetization_package_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references public.monetization_packages(id) not null,
  version_number integer not null,
  display_name text not null,
  description text,
  price_amount numeric(12,2) not null,
  currency text not null default 'USD',
  billing_period text not null check (billing_period in ('one_time','monthly','yearly')),
  coins_amount integer,
  bonus_coins_amount integer,
  platform_fee_percent numeric(5,2) not null default 20,
  creator_share_percent numeric(5,2) not null default 80,
  status text not null default 'draft' check (status in ('draft','pending_store_config','ready_to_publish','published','retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  unique(package_id, version_number)
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  package_version_id uuid references public.monetization_package_versions(id) not null,
  platform text not null check (platform in ('ios','android','web','admin_manual')),
  store_product_id text not null,
  revenuecat_offering_id text,
  revenuecat_entitlement_id text,
  status text not null default 'missing',
  created_at timestamptz not null default now(),
  unique(platform, store_product_id)
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) not null unique,
  coin_balance integer not null default 0,
  locked_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references public.wallets(id) not null,
  type text not null,
  amount integer not null,
  related_creator_id uuid,
  related_video_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) not null,
  source_type text not null,
  gross_amount numeric(12,2) not null,
  store_fee_estimate numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  creator_net_amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid,
  reason text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
