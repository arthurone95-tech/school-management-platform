-- Migration: 20261017000007_phase4_attendance_scope
--
-- Follow-up to 20261017000006_phase4_attendance, which applied the attendance
-- tables. Those two functions could not live in 0006 because it is already
-- recorded in supabase_migrations.schema_migrations; migrations are immutable
-- once applied (docs/DATABASE_DOCUMENTATION.md 8).
--
-- Why these exist: a teacher holds `attendance.read/record/correct` (D-030) but
-- deliberately still holds no `class.read` and no `subject.read`, which stay
-- administrator-only because they expose whole-school learner-facing
-- configuration (docs/AGENTS.md 5, least privilege). Taking attendance needs
-- exactly two lookups a teacher is entitled to:
--
--   * the classes they are assigned to take attendance for, and
--   * their own subjects within one of those classes.
--
-- Both are SECURITY DEFINER, fully qualified and empty search_path like the
-- migration 0001 helpers, and both are gated by `can_access_class`, so they
-- fail closed and cannot be pointed at another school. Neither exposes learner
-- personal data: `accessible_classes` returns class names, and `class_subjects`
-- returns subject names and codes only. The learner roster remains behind
-- `class_roster` (0006), which is separately gated.

begin;

create or replace function public.accessible_classes(target_school_id uuid)
returns table (
  class_id uuid,
  class_name text,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.is_active
  from public.classes c
  where c.school_id = target_school_id
    and public.can_access_class(target_school_id, c.id)
  order by c.name;
$$;

comment on function public.accessible_classes(uuid) is
  'Classes the caller may take attendance for: those they are assigned to, or every class when they hold attendance.report. Fail closed.';

create or replace function public.class_subjects(
  target_school_id uuid,
  target_class_id uuid
)
returns table (
  subject_id uuid,
  subject_name text,
  subject_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.code
  from public.subjects s
  where s.school_id = target_school_id
    and s.is_active
    and public.can_access_class(target_school_id, target_class_id)
    and (
      public.has_school_permission(target_school_id, 'attendance.report')
      or exists (
        select 1
        from public.school_members m
        join public.staff_assignments a
          on a.membership_id = m.id
         and a.school_id = m.school_id
        where m.school_id = target_school_id
          and m.user_id = (select auth.uid())
          and m.status = 'active'
          and a.class_id = target_class_id
          and a.subject_id = s.id
      )
    )
  order by s.name;
$$;

comment on function public.class_subjects(uuid, uuid) is
  'Active subjects the caller may use for attendance in one class they can access: their own assignments, or every active subject when they hold attendance.report. Fail closed.';

revoke all on function public.accessible_classes(uuid) from public;
revoke all on function public.class_subjects(uuid, uuid) from public;
revoke all on function public.accessible_classes(uuid) from anon;
revoke all on function public.class_subjects(uuid, uuid) from anon;

grant execute on function public.accessible_classes(uuid) to authenticated;
grant execute on function public.class_subjects(uuid, uuid) to authenticated;

commit;