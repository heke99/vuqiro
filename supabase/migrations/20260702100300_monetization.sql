-- Vuqiro monetization: packages, store products, purchases, wallets,
-- memberships, entitlements, revenue ledger, payouts.

-- ---------------------------------------------------------------------------
-- Package catalog
-- ---------------------------------------------------------------------------

create table public.monetization_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('creator_subscription_tier','coin_pack','boost_pack','platform_premium')),
  status text not null default 'draft' check (status in ('draft','pending_store_config','ready_to_publish','published','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger monetization_packages_updated_at before update on public.monetization_packages
for each row execute function public.set_updated_at();

create table public.monetization_package_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.monetization_packages (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  display_name text not null,
  description text not null default '',
  price_amount numeric(12,2) not null check (price_amount >= 0),
  currency text not null default 'USD',
  billing_period text not null check (billing_period in ('one_time','monthly','yearly')),
  coins_amount integer check (coins_amount is null or coins_amount > 0),
  bonus_coins_amount integer check (bonus_coins_amount is null or bonus_coins_amount >= 0),
  platform_fee_percent numeric(5,2) not null default 20 check (platform_fee_percent between 0 and 100),
  creator_share_percent numeric(5,2) not null default 80 check (creator_share_percent between 0 and 100),
  status text not null default 'draft' check (status in ('draft','pending_store_config','ready_to_publish','published','retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  unique (package_id, version_number)
);

create index package_versions_package_idx on public.monetization_package_versions (package_id);

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  package_version_id uuid not null references public.monetization_package_versions (id) on delete cascade,
  platform text not null check (platform in ('ios','android','web','admin_manual')),
  store_product_id text not null,
  revenuecat_offering_id text,
  revenuecat_entitlement_id text,
  status text not null default 'missing' check (status in ('missing','configured','synced','approved','live','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, store_product_id)
);

create index store_products_version_idx on public.store_products (package_version_id);

create trigger store_products_updated_at before update on public.store_products
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Purchases (store-verified; written by the API from RevenueCat webhooks)
-- ---------------------------------------------------------------------------

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  package_version_id uuid references public.monetization_package_versions (id),
  platform text not null check (platform in ('ios','android','web','admin_manual')),
  store_product_id text not null,
  store_transaction_id text,
  status text not null default 'pending' check (status in ('pending','completed','cancelled','refunded','failed','revoked')),
  price_amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  coins_credited integer check (coins_credited is null or coins_credited >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchases_profile_idx on public.purchases (profile_id, created_at desc);
create unique index purchases_store_txn_idx on public.purchases (platform, store_transaction_id)
  where store_transaction_id is not null;

create trigger purchases_updated_at before update on public.purchases
for each row execute function public.set_updated_at();

create table public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references public.purchases (id) on delete set null,
  provider text not null check (provider in ('revenuecat','stripe','admin')),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index purchase_events_purchase_idx on public.purchase_events (purchase_id);

-- Raw RevenueCat webhook envelope for idempotency + replay.
create table public.revenuecat_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  app_user_id text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processed','skipped','error')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Wallets & coin transactions
-- ---------------------------------------------------------------------------

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  coin_balance integer not null default 0 check (coin_balance >= 0),
  locked_balance integer not null default 0 check (locked_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger wallets_updated_at before update on public.wallets
for each row execute function public.set_updated_at();

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  type text not null check (type in ('purchase','tip','unlock','boost','refund','reversal','admin_adjustment','fraud_hold')),
  amount integer not null,
  label text not null default '',
  related_creator_id uuid references public.creators (id) on delete set null,
  related_video_id uuid references public.videos (id) on delete set null,
  related_purchase_id uuid references public.purchases (id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index coin_transactions_wallet_idx on public.coin_transactions (wallet_id, created_at desc);
create unique index coin_transactions_idempotency_idx on public.coin_transactions (idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Creator memberships (subscriptions) & entitlements
-- ---------------------------------------------------------------------------

create table public.creator_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  tier text not null check (tier in ('support','plus','premium')),
  status text not null default 'active' check (status in ('active','cancelled','expired','paused','grace_period')),
  platform text not null check (platform in ('ios','android','web','admin_manual')),
  store_product_id text,
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, creator_id)
);

create index creator_memberships_creator_idx on public.creator_memberships (creator_id, status);

create trigger creator_memberships_updated_at before update on public.creator_memberships
for each row execute function public.set_updated_at();

create table public.creator_membership_entitlements (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid references public.creator_memberships (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid references public.videos (id) on delete cascade,
  creator_id uuid references public.creators (id) on delete cascade,
  source text not null check (source in ('membership','coin_unlock','admin_grant')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (video_id is not null or creator_id is not null)
);

create index entitlements_profile_idx on public.creator_membership_entitlements (profile_id);
create index entitlements_video_idx on public.creator_membership_entitlements (video_id);
create unique index entitlements_profile_video_idx on public.creator_membership_entitlements (profile_id, video_id)
  where video_id is not null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- Creator revenue ledger & payouts
-- ---------------------------------------------------------------------------

create table public.creator_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  source text not null check (source in ('subscription','tip','unlock','boost','adjustment')),
  gross_amount numeric(12,2) not null,
  platform_fee_amount numeric(12,2) not null default 0,
  store_fee_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','payable','held','paid','refunded','reversed','disputed')),
  related_purchase_id uuid references public.purchases (id) on delete set null,
  related_video_id uuid references public.videos (id) on delete set null,
  payout_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ledger_creator_idx on public.creator_revenue_ledger (creator_id, status, created_at desc);

create trigger ledger_updated_at before update on public.creator_revenue_ledger
for each row execute function public.set_updated_at();

create table public.creator_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators (id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_account_id text unique,
  status text not null default 'not_onboarded' check (status in ('not_onboarded','onboarding_started','verified','restricted')),
  payouts_enabled boolean not null default false,
  requirements_due jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payout_accounts_updated_at before update on public.creator_payout_accounts
for each row execute function public.set_updated_at();

create table public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','payable','held','processing','paid','failed')),
  provider_transfer_id text unique,
  failure_reason text,
  batch_id text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index payouts_creator_idx on public.creator_payouts (creator_id, status);
create index payouts_batch_idx on public.creator_payouts (batch_id);

create trigger payouts_updated_at before update on public.creator_payouts
for each row execute function public.set_updated_at();

alter table public.creator_revenue_ledger
  add constraint ledger_payout_fk foreign key (payout_id) references public.creator_payouts (id) on delete set null;

create table public.payout_holds (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  payout_id uuid references public.creator_payouts (id) on delete set null,
  reason text not null check (reason in ('moderation_case','fraud_review','refund_risk','creator_verification_missing','manual_admin_hold','legal_review')),
  note text,
  placed_by uuid not null references public.admin_users (id),
  released_by uuid references public.admin_users (id),
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index payout_holds_creator_idx on public.payout_holds (creator_id) where released_at is null;
