-- Migration: 20261015000004_staff_invitations
--
-- Shareable staff invitation links (D-025, which replaces the email-delivery
-- mechanics of D-024 while keeping its authentication, role and school-scoping
-- decisions intact).
--
-- Why a server-side credential store is required
-- ----------------------------------------------
-- The approved workflow lets an authorized school administrator generate a
-- single-use activation link and share it through any channel they choose
-- (WhatsApp, SMS, in person). That needs three guarantees GoTrue's built-in
-- invite email does not give on its own:
--
--   * A 72-hour, staff-invitation-scoped expiry. GoTrue's one-time-token
--     lifetime is a single project-wide setting; raising it to 72 hours would
--     also extend password-recovery and magic-link tokens, which is a material
--     weakening of authentication security.
--   * Server-enforced revocation of a *pending* invitation without destroying
--     the Supabase Auth account.
--   * Server-enforced single-use consumption, so a link can never be replayed
--     even under concurrent acceptance requests.
--
-- This mirrors the already-approved student credential store
-- (`public.learner_portal_credentials`, D-019/8.2) so the same hashing and
-- single-use rules apply, but it is a separate table with separate authorization
-- rules: staff invitation acceptance and student portal activation are distinct
-- flows and are deliberately not merged.
--
-- Security model
-- --------------
--   * Only a keyed hash of the link credential is stored (`credential_hash`);
--     the raw credential is returned once at issue and never persisted.
--   * Every row is bound to its school, membership, recipient, role and inviter.
--   * RLS is enabled with **no policies**, so the table is reachable only by the
--     server-only secret key; ordinary authenticated requests can never read a
--     credential hash.
--   * The partial unique index keeps at most one live (unaccepted, unrevoked)
--     invitation per membership, so a re-issue cannot leave two working links.

begin;

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  membership_id uuid not null
    references public.school_members (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Recipient identity and binding, stored normalised (trimmed, lower-case).
  email text not null check (length(btrim(email)) between 3 and 254),
  role text not null check (length(btrim(role)) between 1 and 40),
  invited_by uuid references auth.users (id) on delete set null,
  -- Only a 64-character lower-case hex hash of the single-use credential is
  -- ever stored, exactly like learner_portal_credentials.
  credential_hash text not null unique
    check (credential_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_invitations_expiry_check check (expires_at > issued_at)
);

-- At most one live invitation per membership. Accepted and revoked rows are
-- excluded, so history and replacements coexist.
create unique index staff_invitations_one_live_per_membership
  on public.staff_invitations (membership_id)
  where accepted_at is null and revoked_at is null;

-- Re-invitation resolves an unaccepted invitation by school and recipient.
create index staff_invitations_school_email_idx
  on public.staff_invitations (school_id, email);

comment on table public.staff_invitations is
  'Single-use, expiring staff invitation link credentials (D-025). Only a hash is stored. RLS enabled with no policies: reachable only by the server-only secret key.';

-- ---------------------------------------------------------------------------
-- Row Level Security: deny all client access (server-only table)
-- ---------------------------------------------------------------------------

alter table public.staff_invitations enable row level security;

-- Intentionally no policies. Like learner_portal_credentials, this table is
-- reachable only by the server-only secret key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Privileges: the outer boundary around RLS
-- ---------------------------------------------------------------------------

revoke all on public.staff_invitations from anon;
revoke all on public.staff_invitations from authenticated;

grant select, insert, update, delete on public.staff_invitations to service_role;

commit;
