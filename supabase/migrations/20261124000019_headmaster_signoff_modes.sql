-- Three-option headmaster sign-off configuration (owner instruction).
-- Migration: 20261124000019_headmaster_signoff_modes.sql

-- School-level configuration. `headmaster_signature_url` is added here because
-- the earlier launch migration did not create it even though the profile API
-- already reads and writes it.
alter table public.schools
  add column if not exists headmaster_signature_url text,
  add column if not exists sign_off_mode text not null default 'image',
  add column if not exists headmaster_name text,
  add column if not exists headmaster_title text;

alter table public.schools
  drop constraint if exists schools_sign_off_mode_check;

alter table public.schools
  add constraint schools_sign_off_mode_check
    check (sign_off_mode in ('image', 'stamp', 'draw'));

comment on column public.schools.sign_off_mode is
  'Active headmaster sign-off mode: image, stamp, or draw.';
comment on column public.schools.headmaster_name is
  'Signatory name used by the name and title stamp mode.';
comment on column public.schools.headmaster_title is
  'Signatory title used by the name and title stamp mode.';

-- Snapshot columns on each report card. A confirmed card keeps the sign-off
-- that was active at confirmation time, so later config changes cannot rewrite
-- an already issued report.
alter table public.report_cards
  add column if not exists sign_off_mode text,
  add column if not exists signatory_name text,
  add column if not exists signatory_title text,
  add column if not exists signature_asset_url text;

alter table public.report_cards
  drop constraint if exists report_cards_sign_off_mode_check;

alter table public.report_cards
  add constraint report_cards_sign_off_mode_check
    check (sign_off_mode in ('image', 'stamp', 'draw'));

-- Storage bucket and school-scoped policies are created only when Supabase's
-- storage schema is present. The local PGlite migration harness does not
-- provide that schema.
do $$
begin
  if exists (
    select 1 from information_schema.schemata where schema_name = 'storage'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    execute $ddl$
      insert into storage.buckets (id, name, public, file_size_limit)
      values ('school-assets', 'school-assets', true, 2097152)
      on conflict (id) do update
        set public = excluded.public,
            file_size_limit = excluded.file_size_limit
    $ddl$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    execute $ddl$
      drop policy if exists school_assets_public_read on storage.objects
    $ddl$;
    execute $ddl$
      create policy school_assets_public_read
        on storage.objects for select to public
        using (bucket_id = 'school-assets')
    $ddl$;

    execute $ddl$
      drop policy if exists school_assets_school_manage_write on storage.objects
    $ddl$;
    execute $ddl$
      create policy school_assets_school_manage_write
        on storage.objects for all to authenticated
        using (
          bucket_id = 'school-assets'
          and public.has_school_permission(
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else '00000000-0000-0000-0000-000000000000'::uuid
            end,
            'school.manage'
          )
        )
        with check (
          bucket_id = 'school-assets'
          and public.has_school_permission(
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else '00000000-0000-0000-0000-000000000000'::uuid
            end,
            'school.manage'
          )
        )
    $ddl$;
  end if;
end $$;
