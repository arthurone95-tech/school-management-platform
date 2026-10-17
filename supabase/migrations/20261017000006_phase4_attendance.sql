-- Migration: 20261017000006_phase4_attendance
--
-- The first Phase 4 slice: class attendance (docs/ROADMAP_AND_TESTING.md,
-- "Teaching and academic workflows"; docs/DECISIONS.md D-030).
--
-- Owner-approved scope, 2026-10-17:
--
--   * Statuses: present, absent, late, excused.
--   * A teacher takes and corrects attendance for the classes they are assigned
--     to through `staff_assignments`; an administrator may do the same for any
--     class in their school and may view per-class reports. Every change is
--     audited by the `audit_row_change` trigger (D-023 pattern: state, not a
--     hard delete).
--   * No timetable: a session is identified by class + date + optional subject,
--     so a timetable table is not a prerequisite.
--
-- Least privilege (docs/AGENTS.md 4, 5):
--
--   * `can_access_class` is the single scope test. It grants a school-wide pass
--     only to a caller holding `attendance.report` (the administrator) and
--     otherwise requires an active membership with a `staff_assignments` row
--     for that exact class, so a teacher cannot reach another class by guessing
--     an id.
--   * A teacher still holds no `learner.read`, so the roster is exposed through
--     `class_roster`, which returns only id, registration number and name for
--     the current placements of a class the caller may access. No date of
--     birth, address, guardian contact or portal state crosses that boundary.
--   * Both tables have RLS enabled, no delete policy at all, and `anon` is
--     revoked: attendance is a record, corrected by update, never deleted.
--   * Every row carries `school_id`, and composite foreign keys keep a session
--     with its class/subject/term/year and a record with its session and
--     learner, all in one school.

begin;

-- ---------------------------------------------------------------------------
-- Attendance sessions
-- ---------------------------------------------------------------------------

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  class_id uuid not null,
  subject_id uuid,
  -- Derived from session_date when the school has a matching term; null
  -- otherwise. Academic structure is optional for attendance (D-029), so a
  -- school with no terms configured can still record it.
  academic_year_id uuid,
  term_id uuid,
  session_date date not null,
  notes text check (notes is null or length(btrim(notes)) <= 200),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_class_school_fkey
    foreign key (class_id, school_id)
    references public.classes (id, school_id) on delete restrict,
  constraint attendance_sessions_subject_school_fkey
    foreign key (subject_id, school_id)
    references public.subjects (id, school_id) on delete restrict,
  constraint attendance_sessions_year_school_fkey
    foreign key (academic_year_id, school_id)
    references public.academic_years (id, school_id) on delete restrict,
  constraint attendance_sessions_term_school_fkey
    foreign key (term_id, school_id)
    references public.terms (id, school_id) on delete restrict,
  constraint attendance_sessions_id_school_key unique (id, school_id)
);

-- One session per class, date and subject. subject_id is nullable, so the key
-- normalises NULL instead of relying on `nulls not distinct`.
create unique index attendance_sessions_one_per_class_date_subject_idx
  on public.attendance_sessions (
    class_id,
    session_date,
    coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index attendance_sessions_school_date_idx
  on public.attendance_sessions (school_id, session_date desc);

comment on table public.attendance_sessions is
  'One class lesson on one date (optionally for a subject). Corrected by update, never deleted.';

-- ---------------------------------------------------------------------------
-- Attendance records
-- ---------------------------------------------------------------------------

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  session_id uuid not null,
  learner_id uuid not null,
  status text not null
    check (status in ('present', 'absent', 'late', 'excused')),
  note text check (note is null or length(btrim(note)) <= 200),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_session_school_fkey
    foreign key (session_id, school_id)
    references public.attendance_sessions (id, school_id) on delete cascade,
  constraint attendance_records_learner_school_fkey
    foreign key (learner_id, school_id)
    references public.learners (id, school_id) on delete restrict,
  constraint attendance_records_one_per_learner unique (session_id, learner_id)
);

create index attendance_records_session_idx
  on public.attendance_records (session_id);

comment on table public.attendance_records is
  'One learner''s attendance status in one session. Corrections are updates and are audited.';

-- ---------------------------------------------------------------------------
-- Authorization helpers
--
-- SECURITY DEFINER and fully qualified, like the migration 0001 helpers: they
-- read school_members, staff_assignments and learners, which are themselves
-- protected by RLS. Inputs are limited to school and target ids; no untrusted
-- SQL. Every test fails closed.
-- ---------------------------------------------------------------------------

create or replace function public.can_access_class(
  target_school_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_school_permission(target_school_id, 'attendance.report')
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
    );
$$;

comment on function public.can_access_class(uuid, uuid) is
  'True when the caller holds attendance.report for the school or is actively assigned to that class. Fail closed.';

create or replace function public.can_access_attendance_session(
  target_school_id uuid,
  target_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attendance_sessions s
    where s.id = target_session_id
      and s.school_id = target_school_id
      and public.can_access_class(s.school_id, s.class_id)
  );
$$;

comment on function public.can_access_attendance_session(uuid, uuid) is
  'True when the caller may act on that session, via can_access_class on its class. Fail closed.';

create or replace function public.class_roster(
  target_school_id uuid,
  target_class_id uuid
)
returns table (
  learner_id uuid,
  registration_number text,
  full_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.registration_number,
         btrim(l.first_name || ' ' || l.last_name) as full_name
  from public.learner_class_placements p
  join public.learners l
    on l.id = p.learner_id
   and l.school_id = p.school_id
  where p.school_id = target_school_id
    and p.class_id = target_class_id
    and p.ended_at is null
    and l.status = 'active'
    and public.can_access_class(target_school_id, target_class_id)
  order by l.last_name, l.first_name, l.id;
$$;

comment on function public.class_roster(uuid, uuid) is
  'Current active learners of one class the caller may access: id, registration number and name only. Grants a teacher the roster for their own classes without learner.read.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

-- sessions: scoped to the caller's classes. No delete policy exists at all.
create policy attendance_sessions_select_scoped
  on public.attendance_sessions for select to authenticated
  using (public.can_access_class(school_id, class_id));

create policy attendance_sessions_insert_recorders
  on public.attendance_sessions for insert to authenticated
  with check (
    public.has_school_permission(school_id, 'attendance.record')
    and public.can_access_class(school_id, class_id)
  );

create policy attendance_sessions_update_recorders
  on public.attendance_sessions for update to authenticated
  using (
    public.has_school_permission(school_id, 'attendance.record')
    and public.can_access_class(school_id, class_id)
  )
  with check (
    public.has_school_permission(school_id, 'attendance.record')
    and public.can_access_class(school_id, class_id)
  );

-- records: scoped through their session's class, so the row's own school_id is
-- checked against the same school on both sides of the foreign key.
create policy attendance_records_select_scoped
  on public.attendance_records for select to authenticated
  using (public.can_access_attendance_session(school_id, session_id));

create policy attendance_records_insert_recorders
  on public.attendance_records for insert to authenticated
  with check (
    public.has_school_permission(school_id, 'attendance.record')
    and public.can_access_attendance_session(school_id, session_id)
  );

create policy attendance_records_update_recorders
  on public.attendance_records for update to authenticated
  using (
    public.has_school_permission(school_id, 'attendance.record')
    and public.can_access_attendance_session(school_id, session_id)
  )
  with check (
    public.has_school_permission(school_id, 'attendance.record')
    and public.can_access_attendance_session(school_id, session_id)
  );

-- ---------------------------------------------------------------------------
-- Audit and updated_at triggers
-- ---------------------------------------------------------------------------

create trigger attendance_sessions_audit
  after insert or update or delete on public.attendance_sessions
  for each row execute function public.audit_row_change();

create trigger attendance_records_audit
  after insert or update or delete on public.attendance_records
  for each row execute function public.audit_row_change();

create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges (the outer boundary around RLS)
--
-- No delete is granted: an attendance session or record is corrected by update
-- and is never removed in normal operation (docs/DECISIONS.md D-023, D-030).
-- ---------------------------------------------------------------------------

revoke all on public.attendance_sessions from anon;
revoke all on public.attendance_records from anon;

grant select, insert, update on public.attendance_sessions to authenticated;
grant select, insert, update on public.attendance_records to authenticated;

grant select, insert, update on public.attendance_sessions to service_role;
grant select, insert, update on public.attendance_records to service_role;

revoke all on function public.can_access_class(uuid, uuid) from public;
revoke all on function public.can_access_attendance_session(uuid, uuid) from public;
revoke all on function public.class_roster(uuid, uuid) from public;
revoke all on function public.class_roster(uuid, uuid) from anon;

grant execute on function public.can_access_class(uuid, uuid) to authenticated;
grant execute on function public.can_access_attendance_session(uuid, uuid) to authenticated;
grant execute on function public.class_roster(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Permission catalogue
--
-- This is the first feature to grant the teacher any permission (D-021 kept the
-- teacher at zero by default, D-030 relaxes that deliberately):
--
--   * attendance.read / attendance.record / attendance.correct - the teacher may
--     work on assigned classes only; the correction window (same day for a
--     teacher, any time for an administrator) is enforced in trusted server
--     code, not in the database.
--   * attendance.report - school-wide read for reports, granted to the
--     school_administrator only. It is what makes can_access_class true for
--     every class in the school.
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, permission) values
  ('school_administrator', 'attendance.read'),
  ('school_administrator', 'attendance.record'),
  ('school_administrator', 'attendance.correct'),
  ('school_administrator', 'attendance.report'),
  ('teacher', 'attendance.read'),
  ('teacher', 'attendance.record'),
  ('teacher', 'attendance.correct')
on conflict (role, permission) do nothing;

commit;