-- Migration: 20261017000008_phase4_attendance_fixture_cleanup
--
-- Follow-up to 20261017000006_phase3/0007_phase4_attendance. Those migrations are
-- already recorded in supabase_migrations.schema_migrations and are therefore
-- immutable, so this change is its own migration.
--
-- Why: `20261016000006` granted the attendance tables to `service_role` without
-- DELETE, and `authenticated` has no delete policy and no DELETE grant at all —
-- the application has no delete path for attendance, which is deliberate
-- (docs/DECISIONS.md D-030, the D-023 state-change pattern).
--
-- That left the non-production test fixtures with no way to clean up: the seed
-- script in `tests/live/02-seed.mjs` deletes learners, and
-- `attendance_records_learner_school_fkey` is ON DELETE RESTRICT, so re-seeding
-- a school that has attendance failed with a foreign key violation.
--
-- This grants DELETE to `service_role` only. That is the server-only secret key,
-- which already bypasses Row Level Security by design; it is not a path the
-- application uses, and nothing here grants DELETE to `anon` or `authenticated`.
-- The invariant that holds is the one that matters to a user: no session can
-- delete an attendance session or record, at any permission level.

begin;

grant delete on public.attendance_sessions to service_role;
grant delete on public.attendance_records to service_role;

comment on table public.attendance_sessions is
  'One class lesson on one date (optionally for a subject). Corrected by update, never deleted: no authenticated role holds DELETE and there is no delete policy.';

comment on table public.attendance_records is
  'One learner''s attendance status in one session. Corrections are updates and are audited. DELETE is granted to service_role alone, for non-production fixture cleanup.';

commit;