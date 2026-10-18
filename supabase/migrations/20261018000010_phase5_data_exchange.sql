-- Migration: 20261018000010_phase5_data_exchange
--
-- The first Phase 5 slice: bulk import and export of learner records
-- (docs/ROADMAP_AND_TESTING.md, "Additional modules and integrations";
-- docs/DECISIONS.md D-032).
--
-- A school arriving with an existing class list cannot enrol 400 students one at
-- a time, and D-028/D-031 recorded "no bulk import" as a known limitation. This
-- migration adds what that needs and nothing more.
--
-- There are **no new tables**, and that is the important design point: an export
-- is a read, and a bulk enrolment is the same `learners` + `learner_class_placements`
-- inserts the single-student flow already performs, on the caller's session
-- client, so Row Level Security and the existing constraints apply unchanged.
--
-- What it does add:
--
--   * Three permissions, granted to `school_administrator` only. Exporting a
--     child's personal data is a distinct act from viewing it, so it gets its own
--     permission rather than riding on `learner.read`.
--   * `record_data_export`, so an export is an **audited event** rather than a
--     silent read. The database writes it, with `auth.uid()` as the actor, so it
--     cannot be forgotten by a caller or attributed to someone else. `audit_events`
--     has no insert policy for ordinary users, which is why this is a SECURITY
--     DEFINER function and not an application insert.

begin;

-- ---------------------------------------------------------------------------
-- Audit an export
-- ---------------------------------------------------------------------------

create or replace function public.record_data_export(
  export_kind text,
  row_count integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if export_kind is null or length(btrim(export_kind)) = 0 then
    raise exception 'export kind is required';
  end if;

  -- `school_id` comes from the caller's own active membership. A caller with no
  -- membership therefore resolves NULL, which violates the NOT NULL on
  -- audit_events and fails the insert: an export by someone who is not a member
  -- of a school cannot record itself. Fail closed rather than audit-less.
  insert into public.audit_events (
    school_id, actor_user_id, action, target_table, target_id, details
  )
  values (
    (
      select m.school_id
      from public.school_members m
      where m.user_id = auth.uid()
        and m.status = 'active'
      order by m.school_id
      limit 1
    ),
    auth.uid(),
    'export',
    'learners',
    export_kind,
    jsonb_build_object('kind', export_kind, 'rows', coalesce(row_count, 0))
  );
end;
$$;

comment on function public.record_data_export(text, integer) is
  'Appends an export event to the audit trail. The database writes it so the actor cannot be supplied or omitted by the caller.';

revoke all on function public.record_data_export(text, integer) from public;
revoke all on function public.record_data_export(text, integer) from anon;
grant execute on function public.record_data_export(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Permission catalogue
--
-- Administrator only. A teacher exports nothing: the export contains children's
-- addresses and guardian phone numbers, which is a wider disclosure than any
-- classroom workflow needs.
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, permission) values
  ('school_administrator', 'learner.import'),
  ('school_administrator', 'learner.export'),
  ('school_administrator', 'report.export')
on conflict (role, permission) do nothing;

commit;