-- Vuqiro 99% completion — advertising & platform revenue:
-- advertisers, ad accounts, campaigns, ad groups, creatives, delivery
-- tracking, billing, direct sponsorship deals, platform revenue ledger.
-- Legal owner: Diversa Solutions LLC

-- ---------------------------------------------------------------------------
-- Advertisers (companies; may be created by superadmin without self-serve)
-- ---------------------------------------------------------------------------

create table public.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  legal_name text not null default '',
  contact_email text not null default '',
  contact_name text not null default '',
  website_url text,
  country text check (country is null or char_length(country) = 2),
  status text not null default 'active' check (status in ('active','suspended','archived')),
  notes text not null default '',
  created_by_admin_id uuid references public.admin_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index advertisers_status_idx on public.advertisers (status, created_at desc);

create trigger advertisers_updated_at before update on public.advertisers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ad accounts (billing containers per advertiser)
-- ---------------------------------------------------------------------------

create table public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  currency text not null default 'USD' check (char_length(currency) = 3),
  balance_cents bigint not null default 0,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ad_accounts_advertiser_idx on public.ad_accounts (advertiser_id);
create index ad_accounts_status_idx on public.ad_accounts (status);

create trigger ad_accounts_updated_at before update on public.ad_accounts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  advertiser_id uuid not null references public.advertisers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  objective text not null default 'awareness' check (objective in ('awareness','traffic','conversions','installs')),
  buying_type text not null default 'cpm' check (buying_type in ('cpm','cpc','cpa','fixed_sponsorship')),
  status text not null default 'draft' check (status in ('draft','pending_review','active','paused','completed','rejected')),
  total_budget_cents bigint check (total_budget_cents is null or total_budget_cents >= 0),
  daily_budget_cents bigint check (daily_budget_cents is null or daily_budget_cents >= 0),
  spent_cents bigint not null default 0 check (spent_cents >= 0),
  cpm_price_cents integer check (cpm_price_cents is null or cpm_price_cents >= 0),
  cpc_price_cents integer check (cpc_price_cents is null or cpc_price_cents >= 0),
  cpa_price_cents integer check (cpa_price_cents is null or cpa_price_cents >= 0),
  fixed_price_cents bigint check (fixed_price_cents is null or fixed_price_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_admin_id uuid references public.admin_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (buying_type <> 'fixed_sponsorship' or fixed_price_cents is not null)
);

create index ad_campaigns_account_idx on public.ad_campaigns (ad_account_id);
create index ad_campaigns_advertiser_idx on public.ad_campaigns (advertiser_id);
create index ad_campaigns_serving_idx on public.ad_campaigns (status, starts_at, ends_at);

create trigger ad_campaigns_updated_at before update on public.ad_campaigns
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ad groups (placement + targeting within a campaign)
-- ---------------------------------------------------------------------------

create table public.ad_groups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'active' check (status in ('active','paused','archived')),
  placements text[] not null default '{feed}',
  -- targeting: { "countries": [], "languages": [], "interests": [], "min_age": 13 }
  targeting jsonb not null default '{}'::jsonb,
  frequency_cap_per_day integer not null default 4 check (frequency_cap_per_day > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (placements <@ array['feed','discover','profile','inbox','post_roll']::text[])
);

create index ad_groups_campaign_idx on public.ad_groups (campaign_id, status);

create trigger ad_groups_updated_at before update on public.ad_groups
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Creatives
-- ---------------------------------------------------------------------------

create table public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  ad_group_id uuid not null references public.ad_groups (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  type text not null default 'card' check (type in ('video','image','card')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500),
  cta_label text not null default 'Learn more' check (char_length(cta_label) <= 40),
  cta_url text not null,
  media_url text,
  thumbnail_url text,
  video_id uuid references public.videos (id) on delete set null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references public.admin_users (id),
  reviewed_at timestamptz,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ad_creatives_group_idx on public.ad_creatives (ad_group_id, status);
create index ad_creatives_campaign_idx on public.ad_creatives (campaign_id);
create index ad_creatives_review_idx on public.ad_creatives (review_status);

create trigger ad_creatives_updated_at before update on public.ad_creatives
for each row execute function public.set_updated_at();

-- feed_impressions.ad_creative_id was created before this table existed.
alter table public.feed_impressions
  add constraint feed_impressions_ad_creative_fk
  foreign key (ad_creative_id) references public.ad_creatives (id) on delete set null;

create index feed_impressions_ad_creative_idx on public.feed_impressions (ad_creative_id);

-- ---------------------------------------------------------------------------
-- Delivery tracking: impressions, clicks, conversions
-- ---------------------------------------------------------------------------

create table public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.ad_creatives (id) on delete cascade,
  ad_group_id uuid not null references public.ad_groups (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  anon_session_id text,
  placement text not null default 'feed' check (placement in ('feed','discover','profile','inbox','post_roll')),
  country text,
  created_at timestamptz not null default now()
);

create index ad_impressions_creative_idx on public.ad_impressions (creative_id, created_at desc);
create index ad_impressions_campaign_idx on public.ad_impressions (campaign_id, created_at desc);
create index ad_impressions_profile_idx on public.ad_impressions (profile_id, created_at desc);
create index ad_impressions_group_idx on public.ad_impressions (ad_group_id);

create table public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  impression_id uuid references public.ad_impressions (id) on delete set null,
  creative_id uuid not null references public.ad_creatives (id) on delete cascade,
  ad_group_id uuid not null references public.ad_groups (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  anon_session_id text,
  placement text not null default 'feed' check (placement in ('feed','discover','profile','inbox','post_roll')),
  country text,
  created_at timestamptz not null default now()
);

create index ad_clicks_creative_idx on public.ad_clicks (creative_id, created_at desc);
create index ad_clicks_campaign_idx on public.ad_clicks (campaign_id, created_at desc);
create index ad_clicks_profile_idx on public.ad_clicks (profile_id, created_at desc);
create index ad_clicks_impression_idx on public.ad_clicks (impression_id);
create index ad_clicks_group_idx on public.ad_clicks (ad_group_id);

create table public.ad_conversions (
  id uuid primary key default gen_random_uuid(),
  click_id uuid references public.ad_clicks (id) on delete set null,
  creative_id uuid not null references public.ad_creatives (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  type text not null default 'custom' check (type in ('purchase','signup','install','custom')),
  value_cents bigint check (value_cents is null or value_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ad_conversions_campaign_idx on public.ad_conversions (campaign_id, created_at desc);
create index ad_conversions_creative_idx on public.ad_conversions (creative_id);
create index ad_conversions_click_idx on public.ad_conversions (click_id);
create index ad_conversions_profile_idx on public.ad_conversions (profile_id);

-- ---------------------------------------------------------------------------
-- Frequency caps (per viewer, per campaign, per day)
-- ---------------------------------------------------------------------------

create table public.ad_frequency_caps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  -- profile id for signed-in viewers, anon session id otherwise
  viewer_key text not null,
  cap_date date not null default current_date,
  impression_count integer not null default 0 check (impression_count >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (campaign_id, viewer_key, cap_date)
);

create index ad_frequency_caps_viewer_idx on public.ad_frequency_caps (viewer_key, cap_date);

create trigger ad_frequency_caps_updated_at before update on public.ad_frequency_caps
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Billing events (append-only) & direct sponsorship deals
-- ---------------------------------------------------------------------------

create table public.ad_billing_events (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  type text not null check (type in ('impression_charge','click_charge','conversion_charge','fixed_fee','adjustment','refund','top_up')),
  amount_cents bigint not null,
  currency text not null default 'USD' check (char_length(currency) = 3),
  description text not null default '',
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index ad_billing_events_account_idx on public.ad_billing_events (ad_account_id, created_at desc);
create index ad_billing_events_campaign_idx on public.ad_billing_events (campaign_id, created_at desc);
create unique index ad_billing_events_idempotency_idx on public.ad_billing_events (idempotency_key)
  where idempotency_key is not null;

create trigger ad_billing_events_no_mutation before update or delete on public.ad_billing_events
for each row execute function public.prevent_row_mutation();

create table public.direct_sponsorship_deals (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers (id) on delete cascade,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  fixed_price_cents bigint not null check (fixed_price_cents >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  invoice_reference text,
  created_by_admin_id uuid references public.admin_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index direct_sponsorship_deals_advertiser_idx on public.direct_sponsorship_deals (advertiser_id);
create index direct_sponsorship_deals_status_idx on public.direct_sponsorship_deals (status, created_at desc);
create index direct_sponsorship_deals_campaign_idx on public.direct_sponsorship_deals (campaign_id);

create trigger direct_sponsorship_deals_updated_at before update on public.direct_sponsorship_deals
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Platform revenue ledger (append-only; every revenue source lands here)
-- ---------------------------------------------------------------------------

create table public.platform_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('coin_purchase','subscription','boost','premium_unlock_fee','ad_revenue','sponsorship','adjustment','refund')),
  reference_type text not null default '',
  reference_id uuid,
  amount_cents bigint not null,
  currency text not null default 'USD' check (char_length(currency) = 3),
  description text not null default '',
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index platform_revenue_ledger_source_idx on public.platform_revenue_ledger (source, occurred_at desc);
create index platform_revenue_ledger_reference_idx on public.platform_revenue_ledger (reference_type, reference_id);
create unique index platform_revenue_ledger_idempotency_idx on public.platform_revenue_ledger (idempotency_key)
  where idempotency_key is not null;

create trigger platform_revenue_ledger_no_mutation before update or delete on public.platform_revenue_ledger
for each row execute function public.prevent_row_mutation();

-- ---------------------------------------------------------------------------
-- Ad reports (user-submitted; feed into moderation cases)
-- ---------------------------------------------------------------------------

create table public.ad_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  creative_id uuid not null references public.ad_creatives (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  reason text not null check (reason in ('misleading','offensive','scam','adult_content','dangerous_product','irrelevant','other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'submitted' check (status in ('submitted','reviewed','dismissed')),
  moderation_case_id uuid references public.moderation_cases (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ad_reports_creative_idx on public.ad_reports (creative_id);
create index ad_reports_status_idx on public.ad_reports (status, created_at desc);
create index ad_reports_reporter_idx on public.ad_reports (reporter_id);
create index ad_reports_campaign_idx on public.ad_reports (campaign_id);
create index ad_reports_case_idx on public.ad_reports (moderation_case_id);
