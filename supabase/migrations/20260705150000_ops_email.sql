-- Email provider joins the ops surface: health snapshots may record the
-- email channel alongside the other providers.
-- Legal owner: Diversa Solutions LLC

alter table public.integration_health_checks drop constraint integration_health_checks_provider_check;
alter table public.integration_health_checks
  add constraint integration_health_checks_provider_check
  check (provider in ('supabase','video','payments','payouts','push','email','sentry','api'));
