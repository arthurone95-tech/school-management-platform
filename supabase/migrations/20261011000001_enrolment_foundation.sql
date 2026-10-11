-- Migration: 20261011000001_enrolment_foundation
--
-- First schema migration for the approved enrolment slice (D-018, D-019,
-- D-020). It creates the tenant, membership, class, learner, class-placement,
-- portal-credential and audit structures, plus the Row Level Security model.
--
-- STATUS: authored and locally verified (see tests/database/), but NOT applied
-- to any Supabase project or production database. Applying it requires an
-- authorised non-production Supabase project. Verification steps that remain
-- outstanding are listed in docs/PHASE0_RISK_REGISTER.md.
--
-- Security model
-- --------------
-- * School isolation is enforced by RLS on every tenant-owned table.
-- * A learner and a class must belong to the same school; this is enforced by
--   composite foreign keys, not application code
--   (docs/ENROLMENT_PERMISSION_MODEL.md 4).
-- * Authorization is driven by permissions stored as data in
--   `role_permissions`, not by hard-coded role names (5.1). An unknown role
--   simply has no permissions and therefore no access (fail closed).
-- * `learner_portal_credentials` has RLS enabled with no policies, so it is
--   reachable only by the server-only secret key. Credential hashes never
--   reach an ordinary authenticated request.
-- * Membership changes and enrolment corrections are audited by database
--   triggers, so the guarantee does not depend on application code (4).

-- ---------------------------------------------------------------------------
-- Shared helper: maintain updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger helper that stamps updated_at.';

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  -- Readable tenant reference used with a username at student sign-in (D-020).
  -- The alphabet omits I, O, S and Z to reduce transcription errors; it is not
  -- a secret.
  code text not null check (code ~ '^[A-HJ-NP-RT-Y0-9]{4,10}$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_code_key unique (code)
);

comment on table public.schools is
  'A tenant (one school). Created by a trusted server process, never by a client.';

-- ---------------------------------------------------------------------------
-- Membership: which authenticated user belongs to which school, with what role
-- ---------------------------------------------------------------------------

create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  -- Role is a label. Authority comes from role_permissions rows, so adding a
  -- role later is configuration, not a schema change (5.1). Deliberately not
  -- check-constrained to a list of role names.
  role text not null check (length(btrim(role)) between 1 and 40),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unique per school, not globally: D-017 ships one school per account, but
  -- the model must be able to support multiple schools later without redesign.
  constraint school_members_school_user_key unique (school_id, user_id)
);

comment on table public.school_members is
  'Explicit, revocable school membership. A revoked or inactive membership authorizes nothing.';

-- ---------------------------------------------------------------------------
-- Permission catalogue (data, not code)
-- ---------------------------------------------------------------------------

create table public.role_permissions (
  role text not null check (length(btrim(role)) between 1 and 40),
  permission text not null check (length(btrim(permission)) between 1 and 80),
  primary key (role, permission)
);

comment on table public.role_permissions is
  'Global role-to-permission catalogue. Access is decided by these rows, so a role with no rows has no access.';

-- ---------------------------------------------------------------------------
-- Classes (school-scoped entities, not free text)
-- ---------------------------------------------------------------------------

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_school_name_key unique (school_id, name),
  -- Supports the composite foreign key from learner_class_placements.
  constraint classes_id_school_key unique (id, school_id)
);

comment on table public.classes is
  'A class belonging to exactly one school. Naming is school-controlled; capacity, age and prerequisite rules are not enforced (5.3).';

-- ---------------------------------------------------------------------------
-- Learners (students)
-- ---------------------------------------------------------------------------

create table public.learners (
  -- The internal student id (7.2): stable, opaque, never user-entered.
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  registration_number text not null
    check (length(btrim(registration_number)) between 1 and 32),
  first_name text not null check (length(btrim(first_name)) between 1 and 80),
  last_name text not null check (length(btrim(last_name)) between 1 and 80),
  gender text not null check (gender in ('male', 'female', 'other')),
  date_of_birth date not null,
  residential_address text not null
    check (length(btrim(residential_address)) between 1 and 400),
  guardian_phone text not null
    check (length(btrim(guardian_phone)) between 1 and 40),
  -- Optional. Never required for registration or portal access (7.1).
  guardian_email text
    check (
      guardian_email is null
      or guardian_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  -- Enrolment status is separate from portal access state (5.2, 8.1).
  status text not null default 'active' check (status in ('active', 'inactive')),
  portal_access_state text not null default 'none'
    check (
      portal_access_state in (
        'none', 'activation_pending', 'active', 'suspended', 'revoked'
      )
    ),
  -- Login username, unique within the school (7.3). Normalised lower case.
  username text not null
    check (
      length(username) <= 32
      and username ~ '^[a-z][a-z0-9]*([._][a-z0-9]+)*$'
    ),
  -- Links to the Supabase Auth account. Restricted rather than cascading: an
  -- account must be unlinked deliberately, never silently dropped.
  auth_user_id uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learners_school_registration_key unique (school_id, registration_number),
  constraint learners_school_username_key unique (school_id, username),
  constraint learners_auth_user_key unique (auth_user_id),
  constraint learners_id_school_key unique (id, school_id),
  -- A learner has portal access if and only if an account is linked.
  constraint learners_portal_account_consistency check (
    (portal_access_state = 'none') = (auth_user_id is null)
  )
);

comment on table public.learners is
  'An enrolled student. Holds personal data about a child: access is permission-restricted and minimised (docs/SECURITY_AND_PRIVACY.md 4).';

-- ---------------------------------------------------------------------------
-- Class placements (history retained; one current placement per learner)
-- ---------------------------------------------------------------------------

create table public.learner_class_placements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  learner_id uuid not null,
  class_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite foreign keys keep learner, class and placement in one school.
  constraint placements_learner_school_fkey
    foreign key (learner_id, school_id)
    references public.learners (id, school_id) on delete restrict,
  constraint placements_class_school_fkey
    foreign key (class_id, school_id)
    references public.classes (id, school_id) on delete restrict,
  constraint placements_period_check check (ended_at is null or ended_at > started_at)
);

-- One current (open) placement per learner (5.5). Ended placements are history
-- and may accumulate for transfers and future academic-year scoping (E1).
create unique index placements_one_current_per_learner
  on public.learner_class_placements (learner_id)
  where ended_at is null;

comment on table public.learner_class_placements is
  'Class placement history. At most one row per learner may have a null ended_at.';

-- ---------------------------------------------------------------------------
-- Portal credentials (activation and administrator-assisted reset)
-- ---------------------------------------------------------------------------

create table public.learner_portal_credentials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  learner_id uuid not null,
  purpose text not null check (purpose in ('activation', 'reset')),
  -- Only a hash of the one-time credential is ever stored (8.2).
  credential_hash text not null check (length(credential_hash) >= 32),
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint credentials_learner_school_fkey
    foreign key (learner_id, school_id)
    references public.learners (id, school_id) on delete restrict,
  constraint credentials_expiry_check check (expires_at > issued_at)
);

-- At most one live credential per learner and purpose. Re-issue must revoke or
-- expire the previous credential first (8.2).
create unique index credentials_one_live_per_learner_purpose
  on public.learner_portal_credentials (learner_id, purpose)
  where used_at is null and revoked_at is null;

comment on table public.learner_portal_credentials is
  'Hashed, single-use activation/reset credentials. RLS enabled with no policies: reachable only by the server-only secret key.';

-- ---------------------------------------------------------------------------
-- Audit events (append-only; written by triggers, never by ordinary users)
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete restrict,
  -- Deliberately not a foreign key: the audit trail must survive account
  -- removal so that a security-relevant action can still be investigated.
  actor_user_id uuid,
  action text not null,
  target_table text not null,
  target_id text not null,
  -- Minimal, safe detail: changed column names only, never personal values.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_school_created_idx
  on public.audit_events (school_id, created_at desc);

create index audit_events_target_idx
  on public.audit_events (target_table, target_id);

comment on table public.audit_events is
  'Append-only audit trail. Ordinary users have no insert, update or delete policy.';

-- ---------------------------------------------------------------------------
-- Authorization helpers
--
-- These read school_members, which is itself protected by RLS. They are
-- SECURITY DEFINER so the lookup is not blocked by the caller's own policies,
-- and they read the caller identity from the verified session via auth.uid().
-- Inputs are limited to the school id and permission name; no untrusted SQL.
-- ---------------------------------------------------------------------------

create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_members m
    where m.school_id = target_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_school_permission(
  target_school_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_members m
    join public.role_permissions rp on rp.role = m.role
    where m.school_id = target_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and rp.permission = required_permission
  );
$$;

comment on function public.has_school_permission(uuid, text) is
  'True only when the caller has an active membership of the school and their role grants the permission. Fail closed.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.role_permissions enable row level security;
alter table public.classes enable row level security;
alter table public.learners enable row level security;
alter table public.learner_class_placements enable row level security;
alter table public.learner_portal_credentials enable row level security;
alter table public.audit_events enable row level security;

-- schools: visible to members; creation and edits stay server-side only.
create policy schools_select_members
  on public.schools for select
  to authenticated
  using (public.is_school_member(id));

-- school_members: members may see each other; only member managers may change.
create policy school_members_select_members
  on public.school_members for select
  to authenticated
  using (public.is_school_member(school_id));

create policy school_members_insert_managers
  on public.school_members for insert
  to authenticated
  with check (public.has_school_permission(school_id, 'member.manage'));

create policy school_members_update_managers
  on public.school_members for update
  to authenticated
  using (public.has_school_permission(school_id, 'member.manage'))
  with check (public.has_school_permission(school_id, 'member.manage'));

create policy school_members_delete_managers
  on public.school_members for delete
  to authenticated
  using (public.has_school_permission(school_id, 'member.manage'));

-- role_permissions: read-only catalogue, no tenant data.
create policy role_permissions_select_authenticated
  on public.role_permissions for select
  to authenticated
  using (true);

-- classes
create policy classes_select_permitted
  on public.classes for select
  to authenticated
  using (public.has_school_permission(school_id, 'class.read'));

create policy classes_insert_managers
  on public.classes for insert
  to authenticated
  with check (public.has_school_permission(school_id, 'class.manage'));

create policy classes_update_managers
  on public.classes for update
  to authenticated
  using (public.has_school_permission(school_id, 'class.manage'))
  with check (public.has_school_permission(school_id, 'class.manage'));

create policy classes_delete_managers
  on public.classes for delete
  to authenticated
  using (public.has_school_permission(school_id, 'class.manage'));

-- learners: no delete policy, so a hard delete is impossible for clients (5.2).
create policy learners_select_permitted
  on public.learners for select
  to authenticated
  using (public.has_school_permission(school_id, 'learner.read'));

create policy learners_insert_permitted
  on public.learners for insert
  to authenticated
  with check (public.has_school_permission(school_id, 'learner.create'));

create policy learners_update_permitted
  on public.learners for update
  to authenticated
  using (public.has_school_permission(school_id, 'learner.update'))
  with check (public.has_school_permission(school_id, 'learner.update'));

-- learner_class_placements: staff may create the initial placement during
-- enrolment; changing an existing placement requires the placement permission.
create policy placements_select_permitted
  on public.learner_class_placements for select
  to authenticated
  using (public.has_school_permission(school_id, 'learner.read'));

create policy placements_insert_permitted
  on public.learner_class_placements for insert
  to authenticated
  with check (
    public.has_school_permission(school_id, 'learner.create')
    or public.has_school_permission(school_id, 'learner.placement.manage')
  );

create policy placements_update_managers
  on public.learner_class_placements for update
  to authenticated
  using (public.has_school_permission(school_id, 'learner.placement.manage'))
  with check (public.has_school_permission(school_id, 'learner.placement.manage'));

-- audit_events: readable with permission; otherwise insert-only via triggers.
create policy audit_events_select_permitted
  on public.audit_events for select
  to authenticated
  using (public.has_school_permission(school_id, 'audit.read'));

-- learner_portal_credentials intentionally has no policies: deny all to
-- anon/authenticated. Only the server-only secret key may read or write it.

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_target_id text;
  v_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    v_school_id := old.school_id;
    v_target_id := old.id::text;
  else
    v_school_id := new.school_id;
    v_target_id := new.id::text;
  end if;

  if tg_op = 'UPDATE' then
    v_details := jsonb_build_object(
      'changed_columns',
      coalesce(
        (
          select jsonb_agg(n.key order by n.key)
          from jsonb_each(to_jsonb(new)) as n(key, value)
          join jsonb_each(to_jsonb(old)) as o(key, value) on o.key = n.key
          where n.value is distinct from o.value
            and n.key <> 'updated_at'
        ),
        '[]'::jsonb
      )
    );
  end if;

  insert into public.audit_events (
    school_id, actor_user_id, action, target_table, target_id, details
  )
  values (
    v_school_id, auth.uid(), lower(tg_op), tg_table_name, v_target_id, v_details
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.audit_row_change() is
  'AFTER change trigger that appends an audit event. Records changed column names only, not personal values.';

create trigger school_members_audit
  after insert or update or delete on public.school_members
  for each row execute function public.audit_row_change();

create trigger classes_audit
  after insert or update or delete on public.classes
  for each row execute function public.audit_row_change();

create trigger learners_audit
  after insert or update or delete on public.learners
  for each row execute function public.audit_row_change();

create trigger learner_class_placements_audit
  after insert or update or delete on public.learner_class_placements
  for each row execute function public.audit_row_change();

-- updated_at triggers
create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

create trigger school_members_set_updated_at
  before update on public.school_members
  for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

create trigger learners_set_updated_at
  before update on public.learners
  for each row execute function public.set_updated_at();

create trigger learner_class_placements_set_updated_at
  before update on public.learner_class_placements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges
--
-- RLS is the primary control; these grants are the outer boundary so that
-- removing a policy cannot accidentally expose a table to anonymous requests.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- No anonymous access to any tenant data.
revoke all on public.schools from anon;
revoke all on public.school_members from anon;
revoke all on public.role_permissions from anon;
revoke all on public.classes from anon;
revoke all on public.learners from anon;
revoke all on public.learner_class_placements from anon;
revoke all on public.learner_portal_credentials from anon;
revoke all on public.audit_events from anon;

grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.school_members to authenticated;
grant select on public.role_permissions to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update on public.learners to authenticated;
grant select, insert, update on public.learner_class_placements to authenticated;
grant select on public.audit_events to authenticated;

-- Credentials are server-only: no client role may touch them.
revoke all on public.learner_portal_credentials from authenticated;

-- The server-only secret key acts as service_role, which bypasses RLS. It is
-- granted everything because every privileged operation performs its own
-- explicit authorization first. It is never used in browser code.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.schools to service_role;
grant select, insert, update, delete on public.school_members to service_role;
grant select, insert, update, delete on public.role_permissions to service_role;
grant select, insert, update, delete on public.classes to service_role;
grant select, insert, update, delete on public.learners to service_role;
grant select, insert, update, delete on public.learner_class_placements to service_role;
grant select, insert, update, delete on public.learner_portal_credentials to service_role;
grant select, insert, update, delete on public.audit_events to service_role;
grant execute on function public.is_school_member(uuid) to service_role;
grant execute on function public.has_school_permission(uuid, text) to service_role;

-- Helper functions are callable by authenticated sessions only.
revoke all on function public.is_school_member(uuid) from public;
revoke all on function public.has_school_permission(uuid, text) from public;
revoke all on function public.audit_row_change() from public;
grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.has_school_permission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: interim permission catalogue (5.1, section 6 defaults)
--
-- Administrator: full. Staff: create and view enrolments. This is configuration
-- data, revisable without a schema change (E5).
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, permission) values
  ('administrator', 'school.manage'),
  ('administrator', 'member.manage'),
  ('administrator', 'class.manage'),
  ('administrator', 'class.read'),
  ('administrator', 'learner.create'),
  ('administrator', 'learner.read'),
  ('administrator', 'learner.update'),
  ('administrator', 'learner.placement.manage'),
  ('administrator', 'learner.portal.manage'),
  ('administrator', 'audit.read'),
  ('staff', 'class.read'),
  ('staff', 'learner.create'),
  ('staff', 'learner.read')
on conflict (role, permission) do nothing;
