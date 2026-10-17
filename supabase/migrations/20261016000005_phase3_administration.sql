-- Migration: 20261016000005_phase3_administration
--
-- The remaining Phase 3 candidate areas (docs/ROADMAP_AND_TESTING.md), approved
-- by the owner on 2026-10-16 as "all four areas, defaults" and recorded in
-- docs/DECISIONS.md:
--
--   1. School profile and configuration  -- the school name becomes editable by
--      an authorized school administrator. The code stays immutable.
--   2. Academic years and terms          -- school-defined, not hard-coded.
--   3. Subjects                          -- retired by deactivation, never
--      deleted in normal operation.
--   4. Staff assignments                 -- a membership assigned to a class
--      and/or a subject.
--
-- The staff *membership status* workflow (suspend / restore / revoke) needs no
-- schema change here: `school_members.status` and the
-- `school_members_update_managers` policy already exist (migration 0001), and
-- `has_school_permission` already ignores a non-active membership, so a
-- suspended or revoked member loses access immediately.
--
-- Tenant ownership follows the enrolment tables exactly (docs/AGENTS.md 4,
-- docs/ENROLMENT_PERMISSION_MODEL.md 4): every new table carries `school_id`,
-- RLS is enabled with permission-gated policies, and composite foreign keys keep
-- a term with its year, an assignment with its membership/class/subject, and
-- every row with its school.

begin;

-- ---------------------------------------------------------------------------
-- Membership key: lets staff_assignments reference (membership, school)
-- ---------------------------------------------------------------------------

alter table public.school_members
  add constraint school_members_id_school_key unique (id, school_id);

-- ---------------------------------------------------------------------------
-- Academic years and terms
-- ---------------------------------------------------------------------------

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_school_name_key unique (school_id, name),
  constraint academic_years_period_check check (ends_on >= starts_on),
  constraint academic_years_id_school_key unique (id, school_id)
);

-- At most one current year per school, the same shape as the one-open-placement
-- index on learner_class_placements (migration 0001).
create unique index academic_years_one_current_idx
  on public.academic_years (school_id)
  where is_current;

comment on table public.academic_years is
  'A school-defined academic year (label and date range). At most one current year per school.';

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  academic_year_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 40),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_school_year_name_key
    unique (school_id, academic_year_id, name),
  constraint terms_period_check check (ends_on >= starts_on),
  constraint terms_year_school_fkey foreign key (academic_year_id, school_id)
    references public.academic_years (id, school_id) on delete restrict,
  constraint terms_id_school_key unique (id, school_id)
);

comment on table public.terms is
  'A term inside an academic year. The composite foreign key keeps the term and its year in one school.';

-- ---------------------------------------------------------------------------
-- Subjects
-- ---------------------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  code text check (code is null or length(btrim(code)) between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_school_name_key unique (school_id, name),
  constraint subjects_id_school_key unique (id, school_id)
);

comment on table public.subjects is
  'A subject taught by the school. Retired by is_active, not deleted in normal operation.';

-- ---------------------------------------------------------------------------
-- Staff assignments
-- ---------------------------------------------------------------------------

create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  membership_id uuid not null,
  class_id uuid,
  subject_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_assignments_target_check
    check (class_id is not null or subject_id is not null),
  constraint staff_assignments_member_school_fkey
    foreign key (membership_id, school_id)
    references public.school_members (id, school_id) on delete cascade,
  constraint staff_assignments_class_school_fkey
    foreign key (class_id, school_id)
    references public.classes (id, school_id) on delete restrict,
  constraint staff_assignments_subject_school_fkey
    foreign key (subject_id, school_id)
    references public.subjects (id, school_id) on delete restrict
);

-- One row per (membership, class, subject). The two coordinate columns are
-- nullable, so the key normalises NULL rather than relying on
-- `nulls not distinct`, which older engines reject.
create unique index staff_assignments_unique_idx
  on public.staff_assignments (
    membership_id,
    coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

comment on table public.staff_assignments is
  'A staff membership assigned to a class and/or a subject. Composite foreign keys keep every side in one school.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.subjects enable row level security;
alter table public.staff_assignments enable row level security;

-- schools: the existing select policy is member-wide; editing is a manager act.
create policy schools_update_managers
  on public.schools for update
  to authenticated
  using (public.has_school_permission(id, 'school.manage'))
  with check (public.has_school_permission(id, 'school.manage'));

-- academic_years
create policy academic_years_select_permitted
  on public.academic_years for select to authenticated
  using (public.has_school_permission(school_id, 'academic.read'));

create policy academic_years_insert_managers
  on public.academic_years for insert to authenticated
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy academic_years_update_managers
  on public.academic_years for update to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'))
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy academic_years_delete_managers
  on public.academic_years for delete to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'));

-- terms
create policy terms_select_permitted
  on public.terms for select to authenticated
  using (public.has_school_permission(school_id, 'academic.read'));

create policy terms_insert_managers
  on public.terms for insert to authenticated
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy terms_update_managers
  on public.terms for update to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'))
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy terms_delete_managers
  on public.terms for delete to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'));

-- subjects
create policy subjects_select_permitted
  on public.subjects for select to authenticated
  using (public.has_school_permission(school_id, 'subject.read'));

create policy subjects_insert_managers
  on public.subjects for insert to authenticated
  with check (public.has_school_permission(school_id, 'subject.manage'));

create policy subjects_update_managers
  on public.subjects for update to authenticated
  using (public.has_school_permission(school_id, 'subject.manage'))
  with check (public.has_school_permission(school_id, 'subject.manage'));

create policy subjects_delete_managers
  on public.subjects for delete to authenticated
  using (public.has_school_permission(school_id, 'subject.manage'));

-- staff_assignments
create policy staff_assignments_select_permitted
  on public.staff_assignments for select to authenticated
  using (public.has_school_permission(school_id, 'assignment.read'));

create policy staff_assignments_insert_managers
  on public.staff_assignments for insert to authenticated
  with check (public.has_school_permission(school_id, 'assignment.manage'));

create policy staff_assignments_update_managers
  on public.staff_assignments for update to authenticated
  using (public.has_school_permission(school_id, 'assignment.manage'))
  with check (public.has_school_permission(school_id, 'assignment.manage'));

create policy staff_assignments_delete_managers
  on public.staff_assignments for delete to authenticated
  using (public.has_school_permission(school_id, 'assignment.manage'));

-- ---------------------------------------------------------------------------
-- Audit and updated_at triggers
-- ---------------------------------------------------------------------------

create trigger academic_years_audit
  after insert or update or delete on public.academic_years
  for each row execute function public.audit_row_change();

create trigger terms_audit
  after insert or update or delete on public.terms
  for each row execute function public.audit_row_change();

create trigger subjects_audit
  after insert or update or delete on public.subjects
  for each row execute function public.audit_row_change();

create trigger staff_assignments_audit
  after insert or update or delete on public.staff_assignments
  for each row execute function public.audit_row_change();

create trigger academic_years_set_updated_at
  before update on public.academic_years
  for each row execute function public.set_updated_at();

create trigger terms_set_updated_at
  before update on public.terms
  for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

create trigger staff_assignments_set_updated_at
  before update on public.staff_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges (the outer boundary around RLS)
-- ---------------------------------------------------------------------------

revoke all on public.academic_years from anon;
revoke all on public.terms from anon;
revoke all on public.subjects from anon;
revoke all on public.staff_assignments from anon;

grant select, insert, update, delete on public.academic_years to authenticated;
grant select, insert, update, delete on public.terms to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.staff_assignments to authenticated;

grant select, insert, update, delete on public.academic_years to service_role;
grant select, insert, update, delete on public.terms to service_role;
grant select, insert, update, delete on public.subjects to service_role;
grant select, insert, update, delete on public.staff_assignments to service_role;

-- ---------------------------------------------------------------------------
-- Permission catalogue: the school administrator manages all four areas. The
-- teacher keeps zero permissions by default (D-021) and is granted here only
-- when a feature needs it.
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, permission) values
  ('school_administrator', 'academic.read'),
  ('school_administrator', 'academic.manage'),
  ('school_administrator', 'subject.read'),
  ('school_administrator', 'subject.manage'),
  ('school_administrator', 'assignment.read'),
  ('school_administrator', 'assignment.manage')
on conflict (role, permission) do nothing;

commit;
