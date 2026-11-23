-- Assessment Components: per-school configurable assessment components (e.g., class tests, midterms, finals)
-- Migration: 20261106000016_assessment_components.sql

-- Create the assessment_components table
create table public.assessment_components (
  id uuid not null default gen_random_uuid(),
  school_id uuid not null,
  name text not null,
  default_weight numeric not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint assessment_components_pkey primary key (id),

  -- Composite foreign key to enforce tenant isolation
  constraint assessment_components_school_id_fkey
    foreign key (school_id)
    references public.schools (id) on delete cascade,

  -- Ensure name is unique per school
  constraint assessment_components_school_name_key unique (school_id, name),

  -- RLS enabled below; school-scoped policies use has_school_permission.
  constraint assessment_components_id_school_key unique (id, school_id)
);

-- Enable Row Level Security
alter table public.assessment_components enable row level security;

create policy assessment_components_select_permitted
  on public.assessment_components for select to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'));

create policy assessment_components_insert_managers
  on public.assessment_components for insert to authenticated
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy assessment_components_update_managers
  on public.assessment_components for update to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'))
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy assessment_components_delete_managers
  on public.assessment_components for delete to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'));

grant select, insert, update, delete on public.assessment_components to authenticated;
grant all on public.assessment_components to service_role;

create trigger assessment_components_set_updated_at
  before update on public.assessment_components
  for each row execute function public.set_updated_at();

comment on table public.assessment_components is
  'School-defined assessment components (e.g., "Class Assessment", "Midterm Exam", "Final Exam").
  Each component has a default_weight percentage that contributes to overall grading.';

comment on column public.assessment_components.school_id is
  'The school this component belongs to (isolated via RLS)';

comment on column public.assessment_components.name is
  'Name of the assessment component (e.g., "Class Assessment", "End of Term Exam")';

comment on column public.assessment_components.default_weight is
  'Default weight percentage for this component (e.g., 20 for 20%). Components'
  ' per school should total 100%.';

comment on column public.assessment_components.description is
  'Optional description of the assessment component';

comment on column public.assessment_components.is_active is
  'When false, the component is retired but historical records remain.';

comment on column public.assessment_components.created_at is
  'Timestamp when the component was created.';

comment on column public.assessment_components.updated_at is
  'Timestamp when the component was last updated.';