-- Vuqiro coin economy: boost campaigns + atomic wallet functions.
--
-- All coin mutations go through SECURITY DEFINER functions that lock the
-- wallet row (FOR UPDATE), enforce non-negative balances, and honor
-- idempotency keys — concurrent spends can never overdraw or double-apply.

-- ---------------------------------------------------------------------------
-- Boost campaigns
-- ---------------------------------------------------------------------------

create table public.boost_campaigns (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  purchaser_profile_id uuid not null references public.profiles (id) on delete cascade,
  coins_spent integer not null check (coins_spent > 0),
  status text not null default 'active' check (status in ('active','completed','cancelled','rejected')),
  impressions_target integer not null default 0,
  impressions_delivered integer not null default 0 check (impressions_delivered >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boost_campaigns_video_idx on public.boost_campaigns (video_id, status);

create trigger boost_campaigns_updated_at before update on public.boost_campaigns
for each row execute function public.set_updated_at();

alter table public.boost_campaigns enable row level security;

create policy boost_campaigns_select_own on public.boost_campaigns
  for select using (purchaser_profile_id = public.current_profile_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Atomic spend: tips, unlocks, boosts
-- ---------------------------------------------------------------------------

create or replace function public.wallet_spend(
  p_profile_id uuid,
  p_amount integer,
  p_type text,
  p_label text,
  p_idempotency_key text,
  p_related_creator_id uuid default null,
  p_related_video_id uuid default null
)
returns table (transaction_id uuid, new_balance integer, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_existing uuid;
  v_txn_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_type not in ('tip','unlock','boost') then
    raise exception 'invalid spend type %', p_type;
  end if;

  -- Idempotency: replaying the same key is a no-op success.
  select ct.id into v_existing
  from public.coin_transactions ct
  where ct.idempotency_key = p_idempotency_key;
  if found then
    select w.coin_balance into v_wallet.coin_balance
    from public.wallets w where w.profile_id = p_profile_id;
    return query select v_existing, v_wallet.coin_balance, true;
    return;
  end if;

  -- Lock the wallet row for the duration of the transaction.
  select * into v_wallet
  from public.wallets
  where profile_id = p_profile_id
  for update;
  if not found then
    insert into public.wallets (profile_id) values (p_profile_id)
    returning * into v_wallet;
  end if;

  if v_wallet.coin_balance < p_amount then
    raise exception 'insufficient balance: have %, need %', v_wallet.coin_balance, p_amount
      using errcode = 'P0001';
  end if;

  update public.wallets
  set coin_balance = coin_balance - p_amount
  where id = v_wallet.id;

  insert into public.coin_transactions
    (wallet_id, type, amount, label, related_creator_id, related_video_id, idempotency_key)
  values
    (v_wallet.id, p_type, -p_amount, p_label, p_related_creator_id, p_related_video_id, p_idempotency_key)
  returning id into v_txn_id;

  return query select v_txn_id, v_wallet.coin_balance - p_amount, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic credit: purchases, refunds, admin adjustments
-- ---------------------------------------------------------------------------

create or replace function public.wallet_credit(
  p_profile_id uuid,
  p_amount integer,
  p_type text,
  p_label text,
  p_idempotency_key text
)
returns table (transaction_id uuid, new_balance integer, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_existing uuid;
  v_txn_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_type not in ('purchase','refund','admin_adjustment') then
    raise exception 'invalid credit type %', p_type;
  end if;

  select ct.id into v_existing
  from public.coin_transactions ct
  where ct.idempotency_key = p_idempotency_key;
  if found then
    select w.coin_balance into v_wallet.coin_balance
    from public.wallets w where w.profile_id = p_profile_id;
    return query select v_existing, v_wallet.coin_balance, true;
    return;
  end if;

  select * into v_wallet
  from public.wallets
  where profile_id = p_profile_id
  for update;
  if not found then
    insert into public.wallets (profile_id) values (p_profile_id)
    returning * into v_wallet;
  end if;

  update public.wallets
  set coin_balance = coin_balance + p_amount
  where id = v_wallet.id;

  insert into public.coin_transactions (wallet_id, type, amount, label, idempotency_key)
  values (v_wallet.id, p_type, p_amount, p_label, p_idempotency_key)
  returning id into v_txn_id;

  return query select v_txn_id, v_wallet.coin_balance + p_amount, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic reversal (refund clawback): never drops the balance below zero.
-- ---------------------------------------------------------------------------

create or replace function public.wallet_reverse(
  p_profile_id uuid,
  p_amount integer,
  p_label text,
  p_idempotency_key text
)
returns table (transaction_id uuid, new_balance integer, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_existing uuid;
  v_txn_id uuid;
  v_deduct integer;
begin
  select ct.id into v_existing
  from public.coin_transactions ct
  where ct.idempotency_key = p_idempotency_key;
  if found then
    select w.coin_balance into v_wallet.coin_balance
    from public.wallets w where w.profile_id = p_profile_id;
    return query select v_existing, v_wallet.coin_balance, true;
    return;
  end if;

  select * into v_wallet
  from public.wallets
  where profile_id = p_profile_id
  for update;
  if not found then
    return;
  end if;

  v_deduct := least(v_wallet.coin_balance, p_amount);

  update public.wallets
  set coin_balance = coin_balance - v_deduct
  where id = v_wallet.id;

  insert into public.coin_transactions (wallet_id, type, amount, label, idempotency_key)
  values (v_wallet.id, 'reversal', -v_deduct, p_label, p_idempotency_key)
  returning id into v_txn_id;

  return query select v_txn_id, v_wallet.coin_balance - v_deduct, false;
end;
$$;

-- Coin -> USD conversion used for the creator ledger (100 coins = $1.00
-- gross; splits applied from the platform fee config).
create or replace function public.coins_to_usd(p_coins integer)
returns numeric
language sql
immutable
as $$
  select round(p_coins::numeric / 100.0, 2);
$$;
