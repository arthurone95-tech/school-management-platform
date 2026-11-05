-- Academics foundation: academic-year/term status, calendar events, exam
-- schedules and timetable slots.
--
-- Extends the existing academic_years/terms tables with status and activation
-- columns, and adds three new tables for calendar events and examination
-- management. All tables are school-scoped (tenant = school_id) with RLS.

-- ---------------------------------------------------------------------------
-- academic_years: add status and is_active
-- ---------------------------------------------------------------------------

alter table public.academic_years
  add column if not exists status text not null default 'UPCOMING';

alter table public.academic_years
  drop constraint if exists academic_years_status_check;

alter table public.academic_years
  add constraint academic_years_status_check
  check (status in ('UPCOMING', 'ACTIVE', 'CLOSED'));

-- is_active mirrors status for convenience; kept in sync by application code.
alter table public.academic_years
  add column if not exists is_active boolean not null default false;

comment on column public.academic_years.status is
  'Lifecycle status: UPCOMING, ACTIVE, or CLOSED. Only one ACTIVE year per school.';
comment on column public.academic_years.is_active is
  'Convenience flag mirroring status = ACTIVE.';

-- ---------------------------------------------------------------------------
-- terms: add status, is_current, and exam/vacation windows
-- ---------------------------------------------------------------------------

alter table public.terms
  add column if not exists status text not null default 'UPCOMING';

alter table public.terms
  drop constraint if exists terms_status_check;

alter table public.terms
  add constraint terms_status_check
  check (status in ('UPCOMING', 'ACTIVE', 'CLOSED'));

alter table public.terms
  add column if not exists is_current boolean not null default false;

alter table public.terms
  add column if not exists vacation_start date;

alter table public.terms
  add column if not exists vacation_end date;

alter table public.terms
  add column if not exists exam_start date;

alter table public.terms
  add column if not exists exam_end date;

comment on column public.terms.status is
  'Lifecycle status: UPCOMING, ACTIVE, or CLOSED.';
comment on column public.terms.is_current is
  'True for the single current term per school.';
comment on column public.terms.vacation_start is 'Start of vacation period.';
comment on column public.terms.vacation_end is 'End of vacation period.';
comment on column public.terms.exam_start is 'Start of examination period.';
comment on column public.terms.exam_end is 'End of examination period.';

-- At most one current term per school.
create unique index if not exists terms_one_current_idx
  on public.terms (school_id)
  where is_current;

-- ---------------------------------------------------------------------------
-- academic_events (calendar events)
-- ---------------------------------------------------------------------------

create table if not exists public.academic_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  term_id uuid,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text check (description is null or length(btrim(description)) <= 500),
  event_type text not null default 'GENERAL'
    check (event_type in ('GENERAL', 'HOLIDAY', 'EXAM', 'MEETING', 'SPORTS', 'CULTURAL', 'OTHER')),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_events_term_school_fkey
    foreign key (term_id, school_id)
    references public.terms (id, school_id) on delete set null,
  constraint academic_events_period_check check (ends_on >= starts_on),
  constraint academic_events_id_school_key unique (id, school_id)
);

comment on table public.academic_events is
  'School calendar events scoped to a term or the whole year.';

alter table public.academic_events enable row level security;

create policy academic_events_select_permitted
  on public.academic_events for select to authenticated
  using (public.has_school_permission(school_id, 'academic.read'));

create policy academic_events_insert_managers
  on public.academic_events for insert to authenticated
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy academic_events_update_managers
  on public.academic_events for update to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'))
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy academic_events_delete_managers
  on public.academic_events for delete to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'));

create trigger academic_events_set_updated_at
  before update on public.academic_events
  for each row execute function public.set_updated_at();

create trigger academic_events_audit
  after insert or update or delete on public.academic_events
  for each row execute function public.audit_row_change();

revoke all on public.academic_events from anon;
revoke all on public.academic_events from public;
grant select, insert, update, delete on public.academic_events to authenticated;
grant select, insert, update, delete on public.academic_events to service_role;

-- ---------------------------------------------------------------------------
-- exam_schedules
-- ---------------------------------------------------------------------------

create table if not exists public.exam_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  term_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PUBLISHED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_schedules_term_school_fkey
    foreign key (term_id, school_id)
    references public.terms (id, school_id) on delete restrict,
  constraint exam_schedules_period_check check (ends_on >= starts_on),
  constraint exam_schedules_id_school_key unique (id, school_id)
);

comment on table public.exam_schedules is
  'An examination schedule for a term. Status controls result publishing.';

alter table public.exam_schedules enable row level security;

create policy exam_schedules_select_permitted
  on public.exam_schedules for select to authenticated
  using (public.has_school_permission(school_id, 'academic.read'));

create policy exam_schedules_insert_managers
  on public.exam_schedules for insert to authenticated
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy exam_schedules_update_managers
  on public.exam_schedules for update to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'))
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy exam_schedules_delete_managers
  on public.exam_schedules for delete to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'));

create trigger exam_schedules_set_updated_at
  before update on public.exam_schedules
  for each row execute function public.set_updated_at();

create trigger exam_schedules_audit
  after insert or update or delete on public.exam_schedules
  for each row execute function public.audit_row_change();

revoke all on public.exam_schedules from anon;
revoke all on public.exam_schedules from public;
grant select, insert, update, delete on public.exam_schedules to authenticated;
grant select, insert, update, delete on public.exam_schedules to service_role;

-- ---------------------------------------------------------------------------
-- exam_timetable_slots
-- ---------------------------------------------------------------------------

create table if not exists public.exam_timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  exam_schedule_id uuid not null,
  subject_id uuid not null,
  class_id uuid not null,
  exam_date date not null,
  start_time time not null,
  end_time time not null,
  room_name text check (room_name is null or length(btrim(room_name)) between 1 and 80),
  supervisor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_timetable_slots_schedule_school_fkey
    foreign key (exam_schedule_id, school_id)
    references public.exam_schedules (id, school_id) on delete cascade,
  constraint exam_timetable_slots_subject_school_fkey
    foreign key (subject_id, school_id)
    references public.subjects (id, school_id) on delete restrict,
  constraint exam_timetable_slots_class_school_fkey
    foreign key (class_id, school_id)
    references public.classes (id, school_id) on delete restrict,
  constraint exam_timetable_slots_time_check check (end_time > start_time),
  constraint exam_timetable_slots_id_school_key unique (id, school_id)
);

comment on table public.exam_timetable_slots is
  'A single exam slot: subject, class, date, time, room, supervisor.';

alter table public.exam_timetable_slots enable row level security;

create policy exam_timetable_slots_select_permitted
  on public.exam_timetable_slots for select to authenticated
  using (public.has_school_permission(school_id, 'academic.read'));

create policy exam_timetable_slots_insert_managers
  on public.exam_timetable_slots for insert to authenticated
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy exam_timetable_slots_update_managers
  on public.exam_timetable_slots for update to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'))
  with check (public.has_school_permission(school_id, 'academic.manage'));

create policy exam_timetable_slots_delete_managers
  on public.exam_timetable_slots for delete to authenticated
  using (public.has_school_permission(school_id, 'academic.manage'));

create trigger exam_timetable_slots_set_updated_at
  before update on public.exam_timetable_slots
  for each row execute function public.set_updated_at();

create trigger exam_timetable_slots_audit
  after insert or update or delete on public.exam_timetable_slots
  for each row execute function public.audit_row_change();

revoke all on public.exam_timetable_slots from anon;
revoke all on public.exam_timetable_slots from public;
grant select, insert, update, delete on public.exam_timetable_slots to authenticated;
grant select, insert, update, delete on public.exam_timetable_slots to service_role;
