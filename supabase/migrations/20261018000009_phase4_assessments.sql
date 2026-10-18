-- Migration: 20261018000009_phase4_assessments
--
-- The second Phase 4 slice: assessments, results and school-defined grading
-- (docs/ROADMAP_AND_TESTING.md, "Teaching and academic workflows";
-- docs/DECISIONS.md D-031).
--
-- docs/PRD.md 11 lists grading differences between schools as *unvalidated*,
-- and the roadmap says explicitly: "Define grading, reporting, attendance, and
-- academic-period rules from actual school requirements. Do not invent universal
-- rules where schools may differ." The obvious way to implement that is to
-- hard-code a grading scale, and that is exactly what this migration refuses to
-- do.
--
-- Instead, grading is *configured by the school*:
--
--   * `grade_bands` holds the school's own bands (minimum percentage, label,
--     remark, whether passing). A report that finds no band for a score shows
--     the percentage and no grade, which is the honest answer for a school that
--     has not configured a scale.
--   * `assessments` records what was assessed, and its maximum score.
--   * `assessment_results` records the learner's score, or null while it is
--     unmarked.
--
-- Nothing here assumes a number of bands, a pass mark, or a grading scale.
--
-- Tenant ownership follows the enrolment tables and attendance (docs/AGENTS.md
-- 4): every table carries `school_id`, RLS is enabled with policies gated on the
-- caller's scope, and composite foreign keys keep a result with its assessment
-- and its learner in one school.
--
-- Teacher scope reuses `can_access_class` from migration 0006, so an assessment,
-- its results and its reports are reachable only for the classes a teacher is
-- assigned to — the same boundary attendance uses.

begin;

-- ---------------------------------------------------------------------------
-- School-defined grade bands
-- ---------------------------------------------------------------------------

create table public.grade_bands (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  -- Inclusive lower bound as a percentage of the assessment maximum, 0-100.
  min_percentage numeric(5, 2) not null
    check (min_percentage >= 0 and min_percentage <= 100),
  label text not null check (length(btrim(label)) between 1 and 20),
  remark text check (remark is null or length(btrim(remark)) between 1 and 120),
  is_passing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Two bands cannot start at the same percentage; the application additionally
  -- refuses bands whose ranges overlap.
  constraint grade_bands_school_min_key unique (school_id, min_percentage)
);

comment on table public.grade_bands is
  'A school''s own grading bands. Configured per school because schools differ (docs/PRD.md 11). No universal scale is assumed.';

-- ---------------------------------------------------------------------------
-- Assessments
-- ---------------------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  class_id uuid not null,
  subject_id uuid,
  academic_year_id uuid,
  term_id uuid,
  name text not null check (length(btrim(name)) between 1 and 80),
  -- A positive maximum, so a percentage is always computable.
  max_score numeric(7, 2) not null check (max_score > 0),
  assessed_on date not null,
  notes text check (notes is null or length(btrim(notes)) <= 200),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_class_school_fkey
    foreign key (class_id, school_id)
    references public.classes (id, school_id) on delete restrict,
  constraint assessments_subject_school_fkey
    foreign key (subject_id, school_id)
    references public.subjects (id, school_id) on delete restrict,
  constraint assessments_year_school_fkey
    foreign key (academic_year_id, school_id)
    references public.academic_years (id, school_id) on delete restrict,
  constraint assessments_term_school_fkey
    foreign key (term_id, school_id)
    references public.terms (id, school_id) on delete restrict,
  constraint assessments_id_school_key unique (id, school_id)
);

create index assessments_school_class_date_idx
  on public.assessments (school_id, class_id, assessed_on desc);

comment on table public.assessments is
  'An assessment of a class, optionally for one subject. Retired by is_active, never deleted.';

-- ---------------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------------

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  assessment_id uuid not null,
  learner_id uuid not null,
  -- Null while the assessment is unmarked. An absent row and a null score are
  -- therefore different things: absent means never marked, null means marked as
  -- awaiting a decision (for example a withdrawn learner).
  score numeric(7, 2) check (score is null or score >= 0),
  remark text check (remark is null or length(btrim(remark)) <= 200),
  graded_by uuid references auth.users (id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_results_assessment_school_fkey
    foreign key (assessment_id, school_id)
    references public.assessments (id, school_id) on delete cascade,
  constraint assessment_results_learner_school_fkey
    foreign key (learner_id, school_id)
    references public.learners (id, school_id) on delete restrict,
  constraint assessment_results_one_per_learner unique (assessment_id, learner_id)
);

create index assessment_results_assessment_idx
  on public.assessment_results (assessment_id);

comment on table public.assessment_results is
  'One learner''s score for one assessment. A score must not exceed the assessment maximum, enforced by a trigger.';

-- The score ceiling lives in another table, so a check constraint cannot express
-- it. The trigger is SECURITY DEFINER so the lookup is not blocked by the
-- caller's own policies on `assessments`, and it fails closed on a missing
-- assessment rather than accepting an unverifiable score.
create or replace function public.check_result_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max numeric;
begin
  if new.score is null then
    return new;
  end if;

  select a.max_score into v_max
  from public.assessments a
  where a.id = new.assessment_id
    and a.school_id = new.school_id;

  if v_max is null then
    raise exception 'assessment not found'
      using errcode = 'foreign_key_violation';
  end if;

  if new.score > v_max then
    raise exception 'score exceeds the assessment maximum'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger assessment_results_check_score
  before insert or update on public.assessment_results
  for each row execute function public.check_result_score();

-- ---------------------------------------------------------------------------
-- Authorization helpers
--
-- Same shape as the attendance helpers (migration 0006): SECURITY DEFINER,
-- fully qualified, empty search_path, fail closed, and built on
-- can_access_class so a teacher's reach does not widen.
-- ---------------------------------------------------------------------------

create or replace function public.can_access_assessment(
  target_school_id uuid,
  target_assessment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assessments a
    where a.id = target_assessment_id
      and a.school_id = target_school_id
      and public.can_access_class(a.school_id, a.class_id)
  );
$$;

comment on function public.can_access_assessment(uuid, uuid) is
  'True when the caller may act on that assessment, via can_access_class on its class. Fail closed.';

create or replace function public.can_access_assessment_result(
  target_school_id uuid,
  target_assessment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_access_assessment(target_school_id, target_assessment_id);
$$;

comment on function public.can_access_assessment_result(uuid, uuid) is
  'A result is reachable exactly when its assessment is. Fail closed.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.grade_bands enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_results enable row level security;

-- Grade bands are school-wide configuration with no learner data in them, so
-- they are permission-gated rather than class-scoped: a teacher may need to see
-- the scale they are marking against.
create policy grade_bands_select_readers
  on public.grade_bands for select to authenticated
  using (public.has_school_permission(school_id, 'grade.read'));

create policy grade_bands_insert_managers
  on public.grade_bands for insert to authenticated
  with check (public.has_school_permission(school_id, 'grade.manage'));

create policy grade_bands_update_managers
  on public.grade_bands for update to authenticated
  using (public.has_school_permission(school_id, 'grade.manage'))
  with check (public.has_school_permission(school_id, 'grade.manage'));

create policy grade_bands_delete_managers
  on public.grade_bands for delete to authenticated
  using (public.has_school_permission(school_id, 'grade.manage'));

-- assessments: scoped to the caller's classes, like attendance.
create policy assessments_select_scoped
  on public.assessments for select to authenticated
  using (public.can_access_class(school_id, class_id));

create policy assessments_insert_recorders
  on public.assessments for insert to authenticated
  with check (
    public.has_school_permission(school_id, 'assessment.manage')
    and public.can_access_class(school_id, class_id)
  );

create policy assessments_update_recorders
  on public.assessments for update to authenticated
  using (
    public.has_school_permission(school_id, 'assessment.manage')
    and public.can_access_class(school_id, class_id)
  )
  with check (
    public.has_school_permission(school_id, 'assessment.manage')
    and public.can_access_class(school_id, class_id)
  );

create policy assessments_delete_managers
  on public.assessments for delete to authenticated
  using (public.has_school_permission(school_id, 'assessment.manage'));

-- results: scoped through their assessment's class. No delete policy, and no
-- DELETE grant below: a mark is corrected by update, never erased.
create policy assessment_results_select_scoped
  on public.assessment_results for select to authenticated
  using (public.can_access_assessment(school_id, assessment_id));

create policy assessment_results_insert_recorders
  on public.assessment_results for insert to authenticated
  with check (
    public.has_school_permission(school_id, 'result.record')
    and public.can_access_assessment(school_id, assessment_id)
  );

create policy assessment_results_update_recorders
  on public.assessment_results for update to authenticated
  using (
    public.has_school_permission(school_id, 'result.record')
    and public.can_access_assessment(school_id, assessment_id)
  )
  with check (
    public.has_school_permission(school_id, 'result.record')
    and public.can_access_assessment(school_id, assessment_id)
  );

-- ---------------------------------------------------------------------------
-- Audit and updated_at triggers
-- ---------------------------------------------------------------------------

create trigger grade_bands_audit
  after insert or update or delete on public.grade_bands
  for each row execute function public.audit_row_change();

create trigger assessments_audit
  after insert or update or delete on public.assessments
  for each row execute function public.audit_row_change();

create trigger assessment_results_audit
  after insert or update or delete on public.assessment_results
  for each row execute function public.audit_row_change();

create trigger grade_bands_set_updated_at
  before update on public.grade_bands
  for each row execute function public.set_updated_at();

create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

create trigger assessment_results_set_updated_at
  before update on public.assessment_results
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges
--
-- Results hold a child's academic record, so no DELETE is granted to
-- `authenticated` on them and there is no delete policy: a mark is corrected by
-- update and is audited. `anon` is revoked everywhere.
-- ---------------------------------------------------------------------------

revoke all on public.grade_bands from anon;
revoke all on public.assessments from anon;
revoke all on public.assessment_results from anon;

grant select, insert, update on public.grade_bands to authenticated;
grant select, insert, update, delete on public.assessments to authenticated;
grant select, insert, update on public.assessment_results to authenticated;

grant select, insert, update, delete on public.grade_bands to service_role;
grant select, insert, update, delete on public.assessments to service_role;
grant select, insert, update on public.assessment_results to service_role;

revoke all on function public.can_access_assessment(uuid, uuid) from public;
revoke all on function public.can_access_assessment_result(uuid, uuid) from public;
revoke all on function public.can_access_assessment(uuid, uuid) from anon;
revoke all on function public.can_access_assessment_result(uuid, uuid) from anon;

grant execute on function public.can_access_assessment(uuid, uuid) to authenticated;
grant execute on function public.can_access_assessment_result(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Permission catalogue
--
-- The teacher gains marking powers here, exactly as D-030 gave them attendance.
-- `grade.manage`, `result.read` and `assessment.delete` stay administrator-only:
-- a teacher marks the classes they are assigned to but does not configure the
-- school's grading scale or read results school-wide.
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, permission) values
  ('school_administrator', 'assessment.read'),
  ('school_administrator', 'assessment.manage'),
  ('school_administrator', 'result.read'),
  ('school_administrator', 'result.record'),
  ('school_administrator', 'grade.read'),
  ('school_administrator', 'grade.manage'),
  ('school_administrator', 'report.read'),
  ('teacher', 'assessment.read'),
  ('teacher', 'assessment.manage'),
  ('teacher', 'result.record'),
  ('teacher', 'grade.read')
on conflict (role, permission) do nothing;

commit;