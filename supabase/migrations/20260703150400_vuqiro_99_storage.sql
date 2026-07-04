-- Vuqiro 99% completion — Supabase Storage buckets & policies.
--
-- Buckets:
--   avatars          public read; owner-scoped write (path prefix = profile id)
--   thumbnails       public read; service-role write
--   ad-creatives     public read (creatives are vetted before activation);
--                    service-role write
--   report-evidence  private; owner-scoped write; moderator/admin read
--   legal-exports    private; owner read (signed URLs); service-role write
--   admin-assets     private; admin read; service-role write
--
-- Raw video files are NOT stored in Supabase Storage — the video provider
-- (Mux or mock) owns video bytes; only thumbnails/posters live here.
--
-- Guarded so `scripts/validate-migrations.sh` (plain Postgres without the
-- storage schema) can still apply this migration.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping bucket setup (plain Postgres validation)';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values
    ('avatars', 'avatars', true),
    ('thumbnails', 'thumbnails', true),
    ('ad-creatives', 'ad-creatives', true),
    ('report-evidence', 'report-evidence', false),
    ('legal-exports', 'legal-exports', false),
    ('admin-assets', 'admin-assets', false)
  on conflict (id) do nothing;

  -- Avatars: anyone can read; users may only write inside their own folder.
  execute $p$
    create policy avatars_public_read on storage.objects
      for select using (bucket_id = 'avatars')
  $p$;
  execute $p$
    create policy avatars_owner_write on storage.objects
      for insert with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = public.current_profile_id()::text
      )
  $p$;
  execute $p$
    create policy avatars_owner_update on storage.objects
      for update using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = public.current_profile_id()::text
      )
  $p$;
  execute $p$
    create policy avatars_owner_delete on storage.objects
      for delete using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = public.current_profile_id()::text
      )
  $p$;

  -- Thumbnails & ad creatives: public read; service-role writes only.
  execute $p$
    create policy thumbnails_public_read on storage.objects
      for select using (bucket_id = 'thumbnails')
  $p$;
  execute $p$
    create policy ad_creatives_public_read on storage.objects
      for select using (bucket_id = 'ad-creatives')
  $p$;

  -- Report evidence: reporter writes into their own folder; moderators read.
  execute $p$
    create policy report_evidence_owner_write on storage.objects
      for insert with check (
        bucket_id = 'report-evidence'
        and (storage.foldername(name))[1] = public.current_profile_id()::text
      )
  $p$;
  execute $p$
    create policy report_evidence_moderator_read on storage.objects
      for select using (
        bucket_id = 'report-evidence'
        and (
          (storage.foldername(name))[1] = public.current_profile_id()::text
          or public.has_admin_role('moderator')
          or public.has_admin_role('admin')
        )
      )
  $p$;

  -- Legal exports: owner read only (delivery via signed URLs); service writes.
  execute $p$
    create policy legal_exports_owner_read on storage.objects
      for select using (
        bucket_id = 'legal-exports'
        and (storage.foldername(name))[1] = public.current_profile_id()::text
      )
  $p$;

  -- Admin assets: admins read; service-role writes.
  execute $p$
    create policy admin_assets_admin_read on storage.objects
      for select using (bucket_id = 'admin-assets' and public.is_admin())
  $p$;
end;
$$;
