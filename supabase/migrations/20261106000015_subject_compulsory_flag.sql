-- Assessment: Add compulsory/optional flag to subjects
-- Migration: 20261106000015_subject_compulsory_flag.sql
-- Add is_compulsory field to distinguish compulsory (core) vs optional (elective) subjects

alter table public.subjects
  add column if not exists is_compulsory boolean not null default true;

comment on column public.subjects.is_compulsory is
  'Indicates whether a subject is compulsory (core) or optional (elective). Compulsory subjects are required for grade calculation and report generation.';

-- Downgrade: remove the column
-- delete from public.subjects where true;
alter table public.subjects drop column if exists is_compulsory;