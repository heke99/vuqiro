-- Vuqiro 99% completion — RLS for all new tables, role helpers,
-- and missing indexes on existing tables.
--
-- Same principles as 20260702100400_rls.sql: the service role (apps/api)
-- bypasses RLS for privileged writes; clients get the minimum their UI needs;
-- admin access is role-scoped via helper functions.

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

-- True when the caller is an active admin with the given role.
-- platform_superadmin implicitly passes every role check.
create or replace function public.has_admin_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where auth_user_id = auth.uid()
      and is_active
      and (role = role_name or role = 'platform_superadmin')
  );
$$;

-- Explicit alias required by the platform spec (same as is_superadmin()).
create or replace function public.is_platform_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every new table
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.hashtags enable row level security;
alter table public.video_hashtags enable row level security;
alter table public.sounds enable row level security;
alter table public.video_sounds enable row level security;
alter table public.profile_settings enable row level security;
alter table public.user_interests enable row level security;
alter table public.user_safety_settings enable row level security;
alter table public.user_devices enable row level security;
alter table public.push_tokens enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.data_exports enable row level security;
alter table public.consent_events enable row level security;
alter table public.shares enable row level security;
alter table public.mentions enable row level security;
alter table public.video_upload_sessions enable row level security;
alter table public.video_processing_jobs enable row level security;
alter table public.feed_sessions enable row level security;
alter table public.feed_impressions enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.search_events enable row level security;
alter table public.video_analytics_daily enable row level security;
alter table public.creator_analytics_daily enable row level security;
alter table public.trend_snapshots enable row level security;
alter table public.advertisers enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_groups enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_impressions enable row level security;
alter table public.ad_clicks enable row level security;
alter table public.ad_conversions enable row level security;
alter table public.ad_frequency_caps enable row level security;
alter table public.ad_billing_events enable row level security;
alter table public.direct_sponsorship_deals enable row level security;
alter table public.platform_revenue_ledger enable row level security;
alter table public.ad_reports enable row level security;
alter table public.appeals enable row level security;
alter table public.copyright_claims enable row level security;
alter table public.moderation_rules enable row level security;
alter table public.content_safety_signals enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.platform_settings enable row level security;
alter table public.ops_jobs enable row level security;
alter table public.integration_health_checks enable row level security;
alter table public.support_cases enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- ---------------------------------------------------------------------------
-- Content taxonomy: world-readable catalogs
-- ---------------------------------------------------------------------------

create policy categories_select on public.categories
  for select using (is_active or public.is_admin());

create policy hashtags_select on public.hashtags
  for select using (not is_blocked or public.is_admin());

create policy video_hashtags_select on public.video_hashtags
  for select using (true);

create policy sounds_select on public.sounds
  for select using (not is_blocked or public.is_admin());

create policy video_sounds_select on public.video_sounds
  for select using (true);

-- ---------------------------------------------------------------------------
-- User settings: own-row read/write
-- ---------------------------------------------------------------------------

create policy profile_settings_select_own on public.profile_settings
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy profile_settings_insert_own on public.profile_settings
  for insert with check (profile_id = public.current_profile_id());

create policy profile_settings_update_own on public.profile_settings
  for update using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create policy user_interests_select_own on public.user_interests
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy user_interests_insert_own on public.user_interests
  for insert with check (profile_id = public.current_profile_id());

create policy user_interests_delete_own on public.user_interests
  for delete using (profile_id = public.current_profile_id());

create policy user_safety_settings_select_own on public.user_safety_settings
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy user_safety_settings_insert_own on public.user_safety_settings
  for insert with check (profile_id = public.current_profile_id());

create policy user_safety_settings_update_own on public.user_safety_settings
  for update using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create policy user_devices_select_own on public.user_devices
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy user_devices_insert_own on public.user_devices
  for insert with check (profile_id = public.current_profile_id());

create policy user_devices_update_own on public.user_devices
  for update using (profile_id = public.current_profile_id());

create policy push_tokens_select_own on public.push_tokens
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy push_tokens_insert_own on public.push_tokens
  for insert with check (profile_id = public.current_profile_id());

create policy push_tokens_update_own on public.push_tokens
  for update using (profile_id = public.current_profile_id());

create policy push_tokens_delete_own on public.push_tokens
  for delete using (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Privacy: own read + insert; processing is service-role/admin only
-- ---------------------------------------------------------------------------

create policy privacy_requests_select_own on public.privacy_requests
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy privacy_requests_insert_own on public.privacy_requests
  for insert with check (public.is_active_user() and profile_id = public.current_profile_id());

create policy data_exports_select_own on public.data_exports
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy consent_events_select_own on public.consent_events
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy consent_events_insert_own on public.consent_events
  for insert with check (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Shares & mentions
-- ---------------------------------------------------------------------------

create policy shares_insert on public.shares
  for insert with check (profile_id is null or profile_id = public.current_profile_id());

create policy shares_select_own on public.shares
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy mentions_select on public.mentions
  for select using (
    mentioned_profile_id = public.current_profile_id()
    or mentioning_profile_id = public.current_profile_id()
    or public.is_admin()
  );

create policy mentions_insert_own on public.mentions
  for insert with check (public.is_active_user() and mentioning_profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Upload pipeline: owner reads; service-role writes
-- ---------------------------------------------------------------------------

create policy video_upload_sessions_select_own on public.video_upload_sessions
  for select using (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
    or public.is_admin()
  );

create policy video_processing_jobs_select on public.video_processing_jobs
  for select using (
    exists (
      select 1 from public.videos v
      where v.id = video_processing_jobs.video_id and (public.owns_video(v.*) or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Feed & analytics signals: own writes; admin reads; rollups readable by owner
-- ---------------------------------------------------------------------------

create policy feed_sessions_select_own on public.feed_sessions
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy feed_sessions_insert on public.feed_sessions
  for insert with check (profile_id is null or profile_id = public.current_profile_id());

create policy feed_sessions_update_own on public.feed_sessions
  for update using (profile_id = public.current_profile_id());

create policy feed_impressions_insert on public.feed_impressions
  for insert with check (profile_id is null or profile_id = public.current_profile_id());

create policy feed_impressions_select on public.feed_impressions
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy recommendation_events_select_admin on public.recommendation_events
  for select using (public.is_admin());

create policy search_events_insert on public.search_events
  for insert with check (profile_id is null or profile_id = public.current_profile_id());

create policy search_events_select_admin on public.search_events
  for select using (public.is_admin());

create policy video_analytics_daily_select on public.video_analytics_daily
  for select using (
    exists (
      select 1 from public.videos v
      where v.id = video_analytics_daily.video_id and (public.owns_video(v.*) or public.is_admin())
    )
  );

create policy creator_analytics_daily_select on public.creator_analytics_daily
  for select using (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
    or public.is_admin()
  );

create policy trend_snapshots_select on public.trend_snapshots
  for select using (true);

-- ---------------------------------------------------------------------------
-- Ads: admin-scoped reads; delivery tables are service-role write only.
-- Finance data additionally scoped to finance/admin roles.
-- ---------------------------------------------------------------------------

create policy advertisers_select_admin on public.advertisers
  for select using (public.is_admin());

create policy ad_accounts_select_admin on public.ad_accounts
  for select using (public.is_admin());

create policy ad_campaigns_select_admin on public.ad_campaigns
  for select using (public.is_admin());

create policy ad_groups_select_admin on public.ad_groups
  for select using (public.is_admin());

create policy ad_creatives_select_admin on public.ad_creatives
  for select using (public.is_admin());

create policy ad_impressions_select_admin on public.ad_impressions
  for select using (public.is_admin());

create policy ad_clicks_select_admin on public.ad_clicks
  for select using (public.is_admin());

create policy ad_conversions_select_admin on public.ad_conversions
  for select using (public.is_admin());

create policy ad_frequency_caps_select_admin on public.ad_frequency_caps
  for select using (public.is_admin());

create policy ad_billing_events_select_finance on public.ad_billing_events
  for select using (public.has_admin_role('finance') or public.has_admin_role('admin'));

create policy direct_sponsorship_deals_select_admin on public.direct_sponsorship_deals
  for select using (public.is_admin());

create policy platform_revenue_ledger_select_finance on public.platform_revenue_ledger
  for select using (public.has_admin_role('finance') or public.has_admin_role('admin'));

create policy ad_reports_insert_own on public.ad_reports
  for insert with check (public.is_active_user() and reporter_id = public.current_profile_id());

create policy ad_reports_select on public.ad_reports
  for select using (reporter_id = public.current_profile_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Appeals & copyright claims
-- ---------------------------------------------------------------------------

create policy appeals_insert_own on public.appeals
  for insert with check (profile_id = public.current_profile_id());

create policy appeals_select on public.appeals
  for select using (
    profile_id = public.current_profile_id()
    or public.has_admin_role('moderator')
    or public.has_admin_role('admin')
  );

create policy copyright_claims_insert on public.copyright_claims
  for insert with check (
    claimant_profile_id is null or claimant_profile_id = public.current_profile_id()
  );

create policy copyright_claims_select on public.copyright_claims
  for select using (
    claimant_profile_id = public.current_profile_id()
    or exists (
      select 1 from public.videos v
      where v.id = copyright_claims.target_video_id and public.owns_video(v.*)
    )
    or public.has_admin_role('moderator')
    or public.has_admin_role('admin')
  );

-- ---------------------------------------------------------------------------
-- Moderation rules & safety signals: moderator/admin reads
-- ---------------------------------------------------------------------------

create policy moderation_rules_select on public.moderation_rules
  for select using (public.has_admin_role('moderator') or public.has_admin_role('admin'));

create policy content_safety_signals_select on public.content_safety_signals
  for select using (public.has_admin_role('moderator') or public.has_admin_role('admin'));

-- ---------------------------------------------------------------------------
-- Ops: admin reads; service-role writes
-- ---------------------------------------------------------------------------

create policy notification_jobs_select_admin on public.notification_jobs
  for select using (public.is_admin());

create policy admin_invitations_select on public.admin_invitations
  for select using (public.has_admin_role('admin'));

create policy platform_settings_select_admin on public.platform_settings
  for select using (public.is_admin());

create policy ops_jobs_select_admin on public.ops_jobs
  for select using (public.is_admin());

create policy integration_health_select_admin on public.integration_health_checks
  for select using (public.is_admin());

create policy support_cases_select on public.support_cases
  for select using (
    profile_id = public.current_profile_id()
    or public.has_admin_role('support')
    or public.has_admin_role('admin')
  );

create policy support_cases_insert_own on public.support_cases
  for insert with check (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Messaging: members only
-- ---------------------------------------------------------------------------

create policy conversations_select_member on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversations.id
        and cm.profile_id = public.current_profile_id()
    )
    or public.is_admin()
  );

create policy conversation_members_select on public.conversation_members
  for select using (
    profile_id = public.current_profile_id()
    or exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
        and cm.profile_id = public.current_profile_id()
    )
    or public.is_admin()
  );

create policy messages_select_member on public.messages
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.profile_id = public.current_profile_id()
    )
    or public.is_admin()
  );

create policy messages_insert_member on public.messages
  for insert with check (
    public.is_active_user()
    and sender_profile_id = public.current_profile_id()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.profile_id = public.current_profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Missing indexes on existing tables
-- ---------------------------------------------------------------------------

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists likes_profile_idx on public.likes (profile_id, created_at desc);
create index if not exists saves_profile_idx on public.saves (profile_id, created_at desc);
create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists comments_moderation_idx on public.comments (moderation_status);
create index if not exists purchases_status_idx on public.purchases (status);
create index if not exists legal_documents_type_status_idx on public.legal_documents (type, status);
