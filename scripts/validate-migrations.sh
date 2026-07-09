#!/usr/bin/env bash
# Validates Vuqiro Supabase migrations against a local PostgreSQL instance.
#
# Preferred flow (full Supabase runtime): `supabase db reset` with the CLI +
# Docker. This script is the CI/dev fallback when Docker is unavailable: it
# applies a minimal auth-schema shim (auth.users + auth.uid()) and then runs
# every migration in order, failing on the first error.
set -euo pipefail

DB_NAME="${VUQIRO_MIGRATION_DB:-vuqiro_migration_check}"
PSQL="${PSQL:-psql}"

run_sql() {
  "$PSQL" -v ON_ERROR_STOP=1 -q -d "$1" -c "$2"
}

echo "==> Recreating database $DB_NAME"
"$PSQL" -q -d postgres -c "drop database if exists $DB_NAME" >/dev/null
"$PSQL" -q -d postgres -c "create database $DB_NAME" >/dev/null

echo "==> Applying Supabase auth shim"
run_sql "$DB_NAME" "
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid
language sql stable as \$\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$;
create extension if not exists pgcrypto;
"

echo "==> Applying migrations"
for file in supabase/migrations/*.sql; do
  echo "    -> $file"
  "$PSQL" -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f "$file"
done

echo "==> Applying seed"
if [ -f supabase/seed/seed.sql ]; then
  "$PSQL" -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f supabase/seed/seed.sql
fi

echo "==> Sanity checks"
run_sql "$DB_NAME" "
do \$\$
declare
  missing_rls text;
begin
  select string_agg(tablename, ', ') into missing_rls
  from pg_tables t
  where schemaname = 'public'
    and not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity
    );
  if missing_rls is not null then
    raise exception 'Tables without RLS: %', missing_rls;
  end if;
end
\$\$;
"

echo "==> Wallet function assertions"
run_sql "$DB_NAME" "
do \$\$
declare
  v_profile uuid;
  v_result record;
  v_balance integer;
begin
  select id into v_profile from public.profiles where handle = 'vuqiro_viewer';
  if v_profile is null then
    raise exception 'seed viewer profile missing';
  end if;

  -- 1. Spend deducts correctly (seed balance 1250).
  select * into v_result from public.wallet_spend(v_profile, 100, 'tip', 'test tip', 'test-key-1');
  if v_result.new_balance <> 1150 then
    raise exception 'expected 1150 after spend, got %', v_result.new_balance;
  end if;

  -- 2. Idempotent replay does not double-deduct.
  select * into v_result from public.wallet_spend(v_profile, 100, 'tip', 'test tip', 'test-key-1');
  if not v_result.duplicate then
    raise exception 'expected duplicate=true on replayed key';
  end if;
  select coin_balance into v_balance from public.wallets where profile_id = v_profile;
  if v_balance <> 1150 then
    raise exception 'replay changed balance: %', v_balance;
  end if;

  -- 3. Overdraw is rejected.
  begin
    perform public.wallet_spend(v_profile, 999999, 'tip', 'overdraw', 'test-key-2');
    raise exception 'overdraw was not rejected';
  exception
    when others then
      if sqlerrm like '%insufficient balance%' then
        null; -- expected
      else
        raise;
      end if;
  end;
  select coin_balance into v_balance from public.wallets where profile_id = v_profile;
  if v_balance <> 1150 then
    raise exception 'failed spend changed balance: %', v_balance;
  end if;

  -- 4. Credit adds and is idempotent.
  select * into v_result from public.wallet_credit(v_profile, 500, 'purchase', 'test credit', 'credit-key-1');
  if v_result.new_balance <> 1650 then
    raise exception 'expected 1650 after credit, got %', v_result.new_balance;
  end if;
  select * into v_result from public.wallet_credit(v_profile, 500, 'purchase', 'test credit', 'credit-key-1');
  if not v_result.duplicate then
    raise exception 'credit replay not idempotent';
  end if;

  -- 5. Reversal floors at zero.
  select * into v_result from public.wallet_reverse(v_profile, 99999, 'test clawback', 'reverse-key-1');
  if v_result.new_balance <> 0 then
    raise exception 'expected 0 after clawback, got %', v_result.new_balance;
  end if;

  raise notice 'wallet function assertions passed';
end
\$\$;
"

echo "==> 99-completion schema assertions"
run_sql "$DB_NAME" "
do \$\$
declare
  v_profile uuid;
  v_video uuid;
  v_creator_profile uuid;
  v_before integer;
  v_after integer;
  v_ledger uuid;
begin
  -- Role helpers exist.
  if to_regprocedure('public.has_admin_role(text)') is null then
    raise exception 'has_admin_role(text) missing';
  end if;
  if to_regprocedure('public.is_platform_superadmin()') is null then
    raise exception 'is_platform_superadmin() missing';
  end if;

  -- Required new tables exist.
  perform 1 from pg_tables where schemaname = 'public' and tablename in (
    'ad_campaigns','ad_creatives','ad_impressions','direct_sponsorship_deals',
    'platform_revenue_ledger','privacy_requests','data_exports','consent_events',
    'appeals','copyright_claims','platform_settings','integration_health_checks',
    'feed_sessions','feed_impressions','hashtags','sounds','shares',
    'video_upload_sessions','push_tokens','profile_settings'
  ) having count(*) = 20;
  if not found then
    raise exception 'expected 99-completion tables are missing';
  end if;

  -- Counter triggers: a like increments videos.like_count.
  select id into v_profile from public.profiles where handle = 'vuqiro_viewer';
  select id into v_video from public.videos order by created_at limit 1;
  select like_count into v_before from public.videos where id = v_video;
  insert into public.likes (profile_id, video_id) values (v_profile, v_video);
  select like_count into v_after from public.videos where id = v_video;
  if v_after <> v_before + 1 then
    raise exception 'like counter trigger did not increment (% -> %)', v_before, v_after;
  end if;
  delete from public.likes where profile_id = v_profile and video_id = v_video;
  select like_count into v_after from public.videos where id = v_video;
  if v_after <> v_before then
    raise exception 'like counter trigger did not decrement (% -> %)', v_before, v_after;
  end if;

  -- Share counter increments.
  select share_count into v_before from public.videos where id = v_video;
  insert into public.shares (video_id, profile_id, channel) values (v_video, v_profile, 'copy_link');
  select share_count into v_after from public.videos where id = v_video;
  if v_after <> v_before + 1 then
    raise exception 'share counter trigger did not increment';
  end if;

  -- Platform revenue ledger is append-only.
  insert into public.platform_revenue_ledger (source, amount_cents, description)
  values ('sponsorship', 100000, 'validation row') returning id into v_ledger;
  begin
    update public.platform_revenue_ledger set amount_cents = 1 where id = v_ledger;
    raise exception 'platform_revenue_ledger update was not blocked';
  exception
    when others then
      if sqlerrm like '%append-only%' then null; else raise; end if;
  end;

  raise notice '99-completion schema assertions passed';
end
\$\$;
"

echo "==> Launch gap closure schema assertions"
run_sql "$DB_NAME" "
do \$\$
begin
  -- New tables exist.
  perform 1 from pg_tables where schemaname = 'public' and tablename in (
    'mutes','video_not_interested','rate_limit_events'
  ) having count(*) = 3;
  if not found then
    raise exception 'launch gap closure tables are missing';
  end if;

  -- New columns exist.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'videos' and column_name = 'is_featured'
  ) then
    raise exception 'videos.is_featured missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'advertisers' and column_name = 'owner_profile_id'
  ) then
    raise exception 'advertisers.owner_profile_id missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notification_jobs' and column_name = 'provider_message_id'
  ) then
    raise exception 'notification_jobs.provider_message_id missing';
  end if;

  -- Trigram search indexes exist.
  perform 1 from pg_indexes where schemaname = 'public' and indexname in (
    'videos_caption_trgm_idx','profiles_handle_trgm_idx','profiles_display_name_trgm_idx',
    'hashtags_tag_trgm_idx','sounds_title_trgm_idx'
  ) having count(*) = 5;
  if not found then
    raise exception 'trigram search indexes are missing';
  end if;

  -- Reserved handles are blocked on update.
  begin
    update public.profiles set handle = 'admin' where handle = 'vuqiro_viewer';
    raise exception 'reserved handle update was not blocked';
  exception
    when others then
      if sqlerrm like '%reserved%' then null; else raise; end if;
  end;

  raise notice 'launch gap closure schema assertions passed';
end
\$\$;
"

echo "==> Video access + demo flag assertions"
run_sql "$DB_NAME" "
do \$\$
declare
  v_viewer_auth uuid;
  v_owner_auth uuid;
  v_viewer_profile uuid;
  v_locked public.videos;
  v_public public.videos;
  v_membership uuid;
begin
  -- New helper functions exist.
  if to_regprocedure('public.can_view_video(public.videos)') is null then
    raise exception 'can_view_video(videos) missing';
  end if;
  if to_regprocedure('public.has_creator_membership(uuid, text)') is null then
    raise exception 'has_creator_membership(uuid, text) missing';
  end if;

  -- Demo/synthetic flag columns exist.
  perform 1 from information_schema.columns
    where table_schema = 'public'
      and (table_name, column_name) in (
        ('profiles','is_demo'), ('profiles','seed_batch'),
        ('videos','is_demo'), ('videos','seed_batch'),
        ('creator_memberships','is_demo'), ('creator_memberships','seed_batch'),
        ('video_events','is_synthetic'), ('video_events','seed_batch'),
        ('feed_impressions','is_synthetic'), ('feed_impressions','seed_batch')
      )
    having count(*) = 10;
  if not found then
    raise exception 'demo/synthetic flag columns are missing';
  end if;

  select p.auth_user_id, p.id into v_viewer_auth, v_viewer_profile
    from public.profiles p where p.handle = 'vuqiro_viewer';
  select p.auth_user_id into v_owner_auth
    from public.profiles p where p.handle = 'noorbuilds';
  select v.* into v_locked from public.videos v where v.visibility = 'subscribers_only' limit 1;
  select v.* into v_public from public.videos v where v.visibility = 'public' limit 1;
  if v_locked.id is null or v_public.id is null then
    raise exception 'seed videos for access assertions missing';
  end if;

  -- Anonymous: public viewable, members-only not.
  perform set_config('request.jwt.claim.sub', '', true);
  if not public.can_view_video(v_public) then
    raise exception 'anonymous viewer cannot see a public video';
  end if;
  if public.can_view_video(v_locked) then
    raise exception 'anonymous viewer can see a members-only video';
  end if;

  -- Viewer without a membership for that creator: locked.
  perform set_config('request.jwt.claim.sub', v_viewer_auth::text, true);
  if public.can_view_video(v_locked) then
    raise exception 'non-member can see a members-only video';
  end if;

  -- Active membership for the exact creator unlocks it.
  insert into public.creator_memberships (profile_id, creator_id, tier, status, platform)
  values (v_viewer_profile, v_locked.creator_id, 'support', 'active', 'admin_manual')
  on conflict (profile_id, creator_id) do update set status = 'active', tier = 'support'
  returning id into v_membership;
  if not public.can_view_video(v_locked) then
    raise exception 'active member cannot see the members-only video';
  end if;

  -- Expired membership must NOT grant access.
  update public.creator_memberships set status = 'expired' where id = v_membership;
  if public.can_view_video(v_locked) then
    raise exception 'expired membership still grants members-only access';
  end if;
  delete from public.creator_memberships where id = v_membership;

  -- The owning creator always sees their own gated video.
  perform set_config('request.jwt.claim.sub', v_owner_auth::text, true);
  if not public.can_view_video(v_locked) then
    raise exception 'owner cannot see their own members-only video';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'video access + demo flag assertions passed';
end
\$\$;
"

TABLE_COUNT=$("$PSQL" -t -A -d "$DB_NAME" -c "select count(*) from pg_tables where schemaname='public'")
if [ "$TABLE_COUNT" -lt 92 ]; then
  echo "ERROR: expected at least 92 public tables, found $TABLE_COUNT" >&2
  exit 1
fi
echo "==> OK: migrations applied cleanly. public tables: $TABLE_COUNT (all with RLS enabled)"
