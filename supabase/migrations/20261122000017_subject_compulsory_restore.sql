-- Restore: compulsory/optional flag on subjects
-- Migration: 20261122000017_subject_compulsory_restore.sql
--
-- Migration 20261106000015 added `subjects.is_compulsory` and then dropped it in
-- the same file, so the column is absent on every environment that has applied
-- that migration. The subject and grading interface needs the flag to distinguish
-- core subjects from electives. This is a forward-only repair: already-applied
-- migrations are not edited.

alter table public.subjects
  add column if not exists is_compulsory boolean not null default true;

comment on column public.subjects.is_compulsory is
  'Indicates whether a subject is compulsory (core) or optional (elective). Compulsory subjects are required for grade calculation and report generation.';
