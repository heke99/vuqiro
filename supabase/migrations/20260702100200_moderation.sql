-- Vuqiro moderation: reports, cases, actions, notifications, legal, audit.

-- ---------------------------------------------------------------------------
-- Reports & moderation cases
-- ---------------------------------------------------------------------------

create table public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('video','comment','profile','creator')),
  target_id uuid not null,
  reason text not null check (reason in ('harassment','hate','violence','sexual_content','minor_safety','spam','scam','copyright','misinformation','other')),
  status text not null default 'open' check (status in ('open','reviewing','resolved','appealed')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  report_count integer not null default 1 check (report_count >= 0),
  assigned_to uuid references public.admin_users (id),
  resolved_action text check (resolved_action in ('no_action','limit_distribution','remove_content','age_restrict','suspend_user','ban_user','hold_payout','release_payout','restore_content')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index moderation_cases_target_idx on public.moderation_cases (target_type, target_id);
create index moderation_cases_status_idx on public.moderation_cases (status, priority);

create trigger moderation_cases_updated_at before update on public.moderation_cases
for each row execute function public.set_updated_at();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('video','comment','profile','creator')),
  target_id uuid not null,
  reason text not null check (reason in ('harassment','hate','violence','sexual_content','minor_safety','spam','scam','copyright','misinformation','other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'submitted' check (status in ('submitted','attached_to_case','dismissed')),
  moderation_case_id uuid references public.moderation_cases (id) on delete set null,
  created_at timestamptz not null default now()
);

create index reports_target_idx on public.reports (target_type, target_id);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_case_idx on public.reports (moderation_case_id);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases (id) on delete cascade,
  action text not null check (action in ('no_action','limit_distribution','remove_content','age_restrict','suspend_user','ban_user','hold_payout','release_payout','restore_content')),
  actor_id uuid not null references public.admin_users (id),
  note text,
  created_at timestamptz not null default now()
);

create index moderation_actions_case_idx on public.moderation_actions (case_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('new_follower','new_comment','comment_reply','creator_new_video','subscriber_drop','subscription_active','subscription_cancelled','coin_received','video_unlocked','payout_status','moderation_warning','system_notice')),
  title text not null,
  body text not null default '',
  is_read boolean not null default false,
  related_profile_id uuid references public.profiles (id) on delete set null,
  related_video_id uuid references public.videos (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, is_read, created_at desc);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  followers boolean not null default true,
  comments boolean not null default true,
  creator_updates boolean not null default true,
  purchases boolean not null default true,
  payouts boolean not null default true,
  moderation boolean not null default true,
  system boolean not null default true,
  push_enabled boolean not null default false,
  push_token text,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_updated_at before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Legal documents & acceptances
-- ---------------------------------------------------------------------------

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms','privacy','community_guidelines','creator_terms','payout_terms','copyright_takedown','refund_policy')),
  version integer not null check (version > 0),
  title text not null,
  content_md text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (type, version)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id) on delete cascade,
  accepted_at timestamptz not null default now(),
  unique (profile_id, document_id)
);

create index legal_acceptances_profile_idx on public.legal_acceptances (profile_id);

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid references public.admin_users (id),
  actor_role text not null default '',
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs (actor_admin_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);

-- Block updates/deletes: audit logs are immutable.
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs are append-only';
end;
$$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
for each row execute function public.prevent_mutation();
