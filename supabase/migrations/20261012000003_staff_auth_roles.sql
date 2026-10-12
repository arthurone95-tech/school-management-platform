-- Migration: 20261012000003_staff_auth_roles
--
-- Aligns the seeded role catalogue and any existing membership rows with the
-- initial role set approved in D-021 (2026-10-12): Platform Owner, School
-- Administrator, Teacher, Student.
--
-- The first migration seeded the interim *school administrator + school staff*
-- labels ('administrator' and 'staff') that D-021 supersedes (E5 resolved).
-- This migration renames those labels so the permission catalogue and
-- membership rows speak the approved vocabulary:
--
--   'administrator' -> 'school_administrator'  (permission set preserved)
--   'staff'         -> 'teacher'               (no permissions by default, D-021)
--
-- A teacher is deliberately assigned no permission rows here: D-021 states the
-- teacher is by default assigned no permissions, and each approved feature
-- seeds its own teacher permission through the catalogue. Authority comes from
-- role_permissions rows (docs/ENROLMENT_PERMISSION_MODEL.md 5.1), so a renamed
-- role with no catalogue rows fails closed.

begin;

-- Permission catalogue: rename the school-administrator label, preserving its
-- permission set. Cannot collide: 'school_administrator' did not exist yet.
update public.role_permissions
  set role = 'school_administrator'
  where role = 'administrator';

-- Teacher: no permissions by default. The interim 'staff' rows are removed;
-- the role label itself grants nothing.
delete from public.role_permissions
  where role = 'staff';

-- Existing membership rows: keep speaking the approved labels. Any member who
-- was 'staff' becomes 'teacher' and, per D-021, has no permissions until a
-- feature seeds them.
update public.school_members
  set role = 'school_administrator'
  where role = 'administrator';

update public.school_members
  set role = 'teacher'
  where role = 'staff';

commit;