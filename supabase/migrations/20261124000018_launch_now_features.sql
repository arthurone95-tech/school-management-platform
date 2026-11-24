-- Launch preparation features (AGENT_NOW.md)
-- Migration: 20261124000018_launch_now_features.sql

-- 1. Attendance module toggle on schools.
alter table public.schools
  add column if not exists enable_attendance boolean not null default true;

comment on column public.schools.enable_attendance is
  'Whether the daily attendance module is enabled for this school.';

-- 2. Internal health/medical status on learners and staff memberships.
alter table public.learners
  add column if not exists health_status text;

alter table public.school_members
  add column if not exists health_status text;

-- 3. Report card approval state and headmaster sign-off fields.
create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  learner_id uuid not null references public.learners (id) on delete restrict,
  class_id uuid references public.classes (id) on delete restrict,
  term_id uuid references public.terms (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed')),
  teacher_remarks text,
  conduct text,
  attitude text,
  interest text,
  promoted_to text,
  headmaster_remark text,
  headmaster_signature_url text,
  confirmed_by uuid references auth.users (id) on delete restrict,
  confirmed_at timestamptz,
  fee_arrears numeric(12, 2),
  next_term_fee numeric(12, 2),
  total_balance numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_cards_school_learner_term_key unique (school_id, learner_id, term_id)
);

alter table public.report_cards enable row level security;

create policy report_cards_select_permitted
  on public.report_cards for select to authenticated
  using (
    public.has_school_permission(school_id, 'assessment.read')
    or public.has_school_permission(school_id, 'report.read')
  );

create policy report_cards_insert_managers
  on public.report_cards for insert to authenticated
  with check (
    public.has_school_permission(school_id, 'school.manage')
    or public.has_school_permission(school_id, 'report.read')
  );

create policy report_cards_update_managers
  on public.report_cards for update to authenticated
  using (
    public.has_school_permission(school_id, 'school.manage')
    or public.has_school_permission(school_id, 'report.read')
  )
  with check (
    public.has_school_permission(school_id, 'school.manage')
    or public.has_school_permission(school_id, 'report.read')
  );

grant select, insert, update on public.report_cards to authenticated;
grant all on public.report_cards to service_role;

create trigger report_cards_set_updated_at
  before update on public.report_cards
  for each row execute function public.set_updated_at();
