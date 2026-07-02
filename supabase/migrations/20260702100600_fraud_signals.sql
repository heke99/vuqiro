-- Fraud & safety signals surfaced to the admin dashboard.

create table public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('repeated_reports','suspicious_wallet_activity','rapid_uploads','engagement_anomaly','chargeback_risk','multi_account')),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  target_type text not null check (target_type in ('user','creator','video')),
  target_id uuid not null,
  summary text not null default '',
  status text not null default 'open' check (status in ('open','reviewing','dismissed','actioned')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fraud_signals_status_idx on public.fraud_signals (status, severity, created_at desc);
create index fraud_signals_target_idx on public.fraud_signals (target_type, target_id);

create trigger fraud_signals_updated_at before update on public.fraud_signals
for each row execute function public.set_updated_at();

alter table public.fraud_signals enable row level security;

create policy fraud_signals_admin on public.fraud_signals
  for select using (public.is_admin());
