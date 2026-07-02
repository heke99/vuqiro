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

TABLE_COUNT=$("$PSQL" -t -A -d "$DB_NAME" -c "select count(*) from pg_tables where schemaname='public'")
echo "==> OK: migrations applied cleanly. public tables: $TABLE_COUNT (all with RLS enabled)"
