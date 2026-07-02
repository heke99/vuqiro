-- Vuqiro Row Level Security.
--
-- Principles:
--   * RLS is enabled on every table.
--   * The service role (used only by apps/api) bypasses RLS for privileged
--     writes: webhooks, wallets, ledgers, moderation enforcement.
--   * Clients (mobile/admin) get the minimum access their UI needs.
--   * Admin console reads go through is_admin()/is_superadmin().

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.creators enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.feature_flags enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.videos enable row level security;
alter table public.video_assets enable row level security;
alter table public.video_events enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.blocks enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.audit_logs enable row level security;
alter table public.monetization_packages enable row level security;
alter table public.monetization_package_versions enable row level security;
alter table public.store_products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_events enable row level security;
alter table public.revenuecat_webhook_events enable row level security;
alter table public.wallets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.creator_memberships enable row level security;
alter table public.creator_membership_entitlements enable row level security;
alter table public.creator_revenue_ledger enable row level security;
alter table public.creator_payout_accounts enable row level security;
alter table public.creator_payouts enable row level security;
alter table public.payout_holds enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create policy profiles_select on public.profiles
  for select using (status in ('active','suspended') or auth_user_id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Prevent users from escalating their own role/status via the own-row policy.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status
       or new.is_creator is distinct from old.is_creator then
      raise exception 'not allowed to change role/status fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields before update on public.profiles
for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Admin users: readable only by admins; managed by service role.
-- ---------------------------------------------------------------------------

create policy admin_users_select on public.admin_users
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Creators & storefronts
-- ---------------------------------------------------------------------------

create policy creators_select on public.creators
  for select using (true);

create policy creators_update_own on public.creators
  for update using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create or replace function public.protect_creator_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.verification_status is distinct from old.verification_status
       or new.monetization_enabled is distinct from old.monetization_enabled
       or new.moderation_warnings is distinct from old.moderation_warnings then
      raise exception 'not allowed to change verification/monetization fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger creators_protect_fields before update on public.creators
for each row execute function public.protect_creator_fields();

create policy creator_profiles_select on public.creator_profiles
  for select using (true);

create policy creator_profiles_upsert_own on public.creator_profiles
  for insert with check (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
  );

create policy creator_profiles_update_own on public.creator_profiles
  for update using (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
  );

-- ---------------------------------------------------------------------------
-- Feature flags: world-readable, service-role writable.
-- ---------------------------------------------------------------------------

create policy feature_flags_select on public.feature_flags
  for select using (true);

-- ---------------------------------------------------------------------------
-- Account deletion requests
-- ---------------------------------------------------------------------------

create policy deletion_requests_select_own on public.account_deletion_requests
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy deletion_requests_insert_own on public.account_deletion_requests
  for insert with check (profile_id = public.current_profile_id());

create policy deletion_requests_cancel_own on public.account_deletion_requests
  for update using (profile_id = public.current_profile_id() and status = 'requested')
  with check (status in ('requested','cancelled'));

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------

-- Who owns a video (creator's profile).
create or replace function public.owns_video(video_row public.videos)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creators c
    where c.id = video_row.creator_id and c.profile_id = public.current_profile_id()
  );
$$;

create policy videos_select on public.videos
  for select using (
    (
      status = 'ready'
      and moderation_status in ('visible','limited','age_restricted')
      and visibility <> 'private'
    )
    or public.owns_video(videos.*)
    or public.is_admin()
  );

create policy videos_insert_own on public.videos
  for insert with check (
    public.is_active_user()
    and creator_id in (select id from public.creators where profile_id = public.current_profile_id())
  );

create policy videos_update_own on public.videos
  for update using (public.owns_video(videos.*));

create policy videos_delete_own on public.videos
  for delete using (public.owns_video(videos.*));

create or replace function public.protect_video_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.moderation_status is distinct from old.moderation_status
       or new.safety_score is distinct from old.safety_score
       or new.report_count is distinct from old.report_count then
      raise exception 'not allowed to change moderation fields';
    end if;
    -- Owners can only move within a safe subset of statuses.
    if new.status is distinct from old.status
       and new.status not in ('draft','deleted') then
      raise exception 'not allowed to set this video status';
    end if;
  end if;
  return new;
end;
$$;

create trigger videos_protect_fields before update on public.videos
for each row execute function public.protect_video_fields();

-- ---------------------------------------------------------------------------
-- Video assets & events: service-role writes; owner/admin reads.
-- ---------------------------------------------------------------------------

create policy video_assets_select on public.video_assets
  for select using (
    exists (
      select 1 from public.videos v
      where v.id = video_assets.video_id and (public.owns_video(v.*) or public.is_admin())
    )
  );

create policy video_events_insert_own on public.video_events
  for insert with check (profile_id = public.current_profile_id() or profile_id is null);

create policy video_events_select on public.video_events
  for select using (profile_id = public.current_profile_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Social graph
-- ---------------------------------------------------------------------------

create policy follows_select on public.follows
  for select using (auth.uid() is not null);

create policy follows_insert_own on public.follows
  for insert with check (public.is_active_user() and follower_id = public.current_profile_id());

create policy follows_delete_own on public.follows
  for delete using (follower_id = public.current_profile_id());

create policy likes_select on public.likes
  for select using (auth.uid() is not null);

create policy likes_insert_own on public.likes
  for insert with check (public.is_active_user() and profile_id = public.current_profile_id());

create policy likes_delete_own on public.likes
  for delete using (profile_id = public.current_profile_id());

create policy saves_select_own on public.saves
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy saves_insert_own on public.saves
  for insert with check (public.is_active_user() and profile_id = public.current_profile_id());

create policy saves_delete_own on public.saves
  for delete using (profile_id = public.current_profile_id());

create policy blocks_select_own on public.blocks
  for select using (blocker_id = public.current_profile_id() or public.is_admin());

create policy blocks_insert_own on public.blocks
  for insert with check (blocker_id = public.current_profile_id());

create policy blocks_delete_own on public.blocks
  for delete using (blocker_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create policy comments_select on public.comments
  for select using (
    moderation_status in ('visible','limited')
    or author_id = public.current_profile_id()
    or public.is_admin()
  );

create policy comments_insert_own on public.comments
  for insert with check (public.is_active_user() and author_id = public.current_profile_id());

create policy comments_delete_own on public.comments
  for delete using (author_id = public.current_profile_id());

create policy comment_likes_select on public.comment_likes
  for select using (auth.uid() is not null);

create policy comment_likes_insert_own on public.comment_likes
  for insert with check (public.is_active_user() and profile_id = public.current_profile_id());

create policy comment_likes_delete_own on public.comment_likes
  for delete using (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

create policy moderation_cases_admin on public.moderation_cases
  for select using (public.is_admin());

create policy reports_insert_own on public.reports
  for insert with check (public.is_active_user() and reporter_id = public.current_profile_id());

create policy reports_select on public.reports
  for select using (reporter_id = public.current_profile_id() or public.is_admin());

create policy moderation_actions_admin on public.moderation_actions
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create policy notifications_select_own on public.notifications
  for select using (profile_id = public.current_profile_id());

create policy notifications_update_own on public.notifications
  for update using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create policy notification_prefs_select_own on public.notification_preferences
  for select using (profile_id = public.current_profile_id());

create policy notification_prefs_insert_own on public.notification_preferences
  for insert with check (profile_id = public.current_profile_id());

create policy notification_prefs_update_own on public.notification_preferences
  for update using (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Legal
-- ---------------------------------------------------------------------------

create policy legal_documents_select on public.legal_documents
  for select using (status = 'published' or public.is_admin());

create policy legal_acceptances_select_own on public.legal_acceptances
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy legal_acceptances_insert_own on public.legal_acceptances
  for insert with check (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Audit logs: admin read; service-role write only.
-- ---------------------------------------------------------------------------

create policy audit_logs_select_admin on public.audit_logs
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Monetization catalog: published rows are world-readable.
-- ---------------------------------------------------------------------------

create policy packages_select on public.monetization_packages
  for select using (status = 'published' or public.is_admin());

create policy package_versions_select on public.monetization_package_versions
  for select using (status = 'published' or public.is_admin());

create policy store_products_select on public.store_products
  for select using (public.is_admin() or auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Purchases & wallets: owner reads; service-role writes.
-- ---------------------------------------------------------------------------

create policy purchases_select_own on public.purchases
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy purchase_events_select_admin on public.purchase_events
  for select using (public.is_admin());

create policy revenuecat_events_select_admin on public.revenuecat_webhook_events
  for select using (public.is_admin());

create policy wallets_select_own on public.wallets
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy coin_transactions_select_own on public.coin_transactions
  for select using (
    wallet_id in (select id from public.wallets where profile_id = public.current_profile_id())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Memberships, entitlements, ledger, payouts
-- ---------------------------------------------------------------------------

create policy memberships_select on public.creator_memberships
  for select using (
    profile_id = public.current_profile_id()
    or creator_id in (select id from public.creators where profile_id = public.current_profile_id())
    or public.is_admin()
  );

create policy entitlements_select_own on public.creator_membership_entitlements
  for select using (profile_id = public.current_profile_id() or public.is_admin());

create policy ledger_select_own on public.creator_revenue_ledger
  for select using (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
    or public.is_admin()
  );

create policy payout_accounts_select_own on public.creator_payout_accounts
  for select using (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
    or public.is_admin()
  );

create policy payouts_select_own on public.creator_payouts
  for select using (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
    or public.is_admin()
  );

create policy payout_holds_select on public.payout_holds
  for select using (
    creator_id in (select id from public.creators where profile_id = public.current_profile_id())
    or public.is_admin()
  );
