-- Vuqiro 99% completion — safety & operations: appeals, copyright claims,
-- moderation rules, safety signals, notification jobs, admin invitations,
-- platform settings, ops jobs, integration health, support cases, messaging.
-- Legal owner: Diversa Solutions LLC

-- ---------------------------------------------------------------------------
-- Appeals (first-class table; cases keep their 'appealed' status)
-- ---------------------------------------------------------------------------

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  case_id uuid references public.moderation_cases (id) on delete set null,
  target_type text not null check (target_type in ('video','comment','profile','creator','ad')),
  target_id uuid not null,
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open','under_review','approved','rejected')),
  decided_by uuid references public.admin_users (id),
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appeals_profile_idx on public.appeals (profile_id, created_at desc);
create index appeals_case_idx on public.appeals (case_id);
create index appeals_status_idx on public.appeals (status, created_at desc);

create trigger appeals_updated_at before update on public.appeals
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Copyright claims (DMCA-style takedowns)
-- ---------------------------------------------------------------------------

create table public.copyright_claims (
  id uuid primary key default gen_random_uuid(),
  claimant_profile_id uuid references public.profiles (id) on delete set null,
  claimant_name text not null check (char_length(claimant_name) between 1 and 200),
  claimant_email text not null,
  claimant_organization text not null default '',
  target_video_id uuid not null references public.videos (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 4000),
  original_work_url text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','accepted','rejected','counter_claimed','withdrawn')),
  moderation_case_id uuid references public.moderation_cases (id) on delete set null,
  decided_by uuid references public.admin_users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index copyright_claims_video_idx on public.copyright_claims (target_video_id);
create index copyright_claims_status_idx on public.copyright_claims (status, created_at desc);
create index copyright_claims_case_idx on public.copyright_claims (moderation_case_id);

create trigger copyright_claims_updated_at before update on public.copyright_claims
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Automated moderation rules & content safety signals
-- ---------------------------------------------------------------------------

create table public.moderation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  rule_type text not null check (rule_type in ('banned_keywords','rapid_uploads','spam_comments','repeated_reports','purchase_anomaly','refund_abuse','fake_engagement','ad_click_fraud','payout_risk')),
  config jsonb not null default '{}'::jsonb,
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  action text not null default 'flag' check (action in ('flag','create_case','auto_hide')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index moderation_rules_enabled_idx on public.moderation_rules (enabled, rule_type);

create trigger moderation_rules_updated_at before update on public.moderation_rules
for each row execute function public.set_updated_at();

create table public.content_safety_signals (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('video','comment','profile','ad')),
  target_id uuid not null,
  signal text not null,
  score numeric(6,2) not null default 0,
  source text not null default 'rule' check (source in ('rule','model','manual')),
  rule_id uuid references public.moderation_rules (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index content_safety_signals_target_idx on public.content_safety_signals (target_type, target_id);
create index content_safety_signals_created_idx on public.content_safety_signals (created_at desc);
create index content_safety_signals_rule_idx on public.content_safety_signals (rule_id);

-- ---------------------------------------------------------------------------
-- Notification jobs (outbound push/email deliveries)
-- ---------------------------------------------------------------------------

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete set null,
  channel text not null default 'push' check (channel in ('push','email')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_jobs_status_idx on public.notification_jobs (status, scheduled_at);
create index notification_jobs_profile_idx on public.notification_jobs (profile_id);
create index notification_jobs_notification_idx on public.notification_jobs (notification_id);

create trigger notification_jobs_updated_at before update on public.notification_jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin invitations
-- ---------------------------------------------------------------------------

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('platform_superadmin','admin','moderator','finance','support')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references public.admin_users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index admin_invitations_email_idx on public.admin_invitations (email);
create index admin_invitations_status_idx on public.admin_invitations (status, created_at desc);
create index admin_invitations_invited_by_idx on public.admin_invitations (invited_by);

-- ---------------------------------------------------------------------------
-- Platform settings (key/value; feed weights, ad frequency, limits)
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text not null default '',
  updated_by uuid references public.admin_users (id),
  updated_at timestamptz not null default now()
);

create trigger platform_settings_updated_at before update on public.platform_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ops jobs & integration health
-- ---------------------------------------------------------------------------

create table public.ops_jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index ops_jobs_status_idx on public.ops_jobs (status, created_at desc);
create index ops_jobs_name_idx on public.ops_jobs (name, created_at desc);

create table public.integration_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('supabase','video','payments','payouts','push','sentry','api')),
  status text not null check (status in ('ok','degraded','down','unconfigured','mock')),
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index integration_health_provider_idx on public.integration_health_checks (provider, checked_at desc);

-- ---------------------------------------------------------------------------
-- Support cases
-- ---------------------------------------------------------------------------

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null default '',
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null default '' check (char_length(body) <= 8000),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assigned_to uuid references public.admin_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_cases_status_idx on public.support_cases (status, priority, created_at desc);
create index support_cases_profile_idx on public.support_cases (profile_id);
create index support_cases_assigned_idx on public.support_cases (assigned_to);

create trigger support_cases_updated_at before update on public.support_cases
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Messaging foundation (system/support conversations)
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check (type in ('direct','support','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

create table public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (conversation_id, profile_id)
);

create index conversation_members_profile_idx on public.conversation_members (profile_id);
create index conversation_members_conversation_idx on public.conversation_members (conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  moderation_status text not null default 'visible' check (moderation_status in ('visible','removed')),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_profile_id);
