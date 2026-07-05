-- Security hardening: reserved handles (impersonation prevention).
-- Legal owner: Diversa Solutions LLC

-- ---------------------------------------------------------------------------
-- Reserved handles: block impersonation of platform/staff identities.
-- ---------------------------------------------------------------------------

create or replace function public.is_reserved_handle(candidate text)
returns boolean
language sql
immutable
as $$
  select lower(candidate) in (
    'admin','administrator','vuqiro','vuqiro_official','official','support','help',
    'moderator','mod','staff','team','security','root','system','api','payments',
    'billing','legal','privacy','safety','trust','verify','verified','diversa',
    'diversasolutions','no-reply','noreply','postmaster','abuse','info','contact'
  );
$$;

-- New signups: never assign a reserved handle (suffix instead).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_handle text;
  new_profile_id uuid;
begin
  new_handle := coalesce(
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'handle', split_part(new.email, '@', 1), '')), '[^a-z0-9_.]', '', 'g'), ''),
    'user'
  );
  if public.is_reserved_handle(new_handle)
     or exists (select 1 from public.profiles where handle = new_handle) then
    new_handle := left(new_handle, 22) || '_' || substr(md5(random()::text), 1, 6);
  end if;

  insert into public.profiles (auth_user_id, handle, display_name)
  values (new.id, new_handle, coalesce(new.raw_user_meta_data ->> 'display_name', new_handle))
  returning id into new_profile_id;

  insert into public.profile_settings (profile_id) values (new_profile_id)
  on conflict (profile_id) do nothing;
  insert into public.user_safety_settings (profile_id) values (new_profile_id)
  on conflict (profile_id) do nothing;
  insert into public.notification_preferences (profile_id) values (new_profile_id)
  on conflict (profile_id) do nothing;

  insert into public.wallets (profile_id) values (new_profile_id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

-- Handle changes can never take a reserved name (applies to everyone,
-- including the service role — staff accounts are provisioned directly).
create or replace function public.block_reserved_handles()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.handle is distinct from old.handle
     and public.is_reserved_handle(new.handle) then
    raise exception 'handle "%" is reserved', new.handle;
  end if;
  return new;
end;
$$;

create trigger profiles_reserved_handle_guard
before update on public.profiles
for each row execute function public.block_reserved_handles();
