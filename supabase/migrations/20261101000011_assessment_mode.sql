-- Assessment framework mode per school (D-style dual-mode framework).
-- 'ges_standard' (default): read-only GES/NaCCA preset.
-- 'custom': school-defined classes, subjects, grade bands and report layout.
alter table public.schools
  add column if not exists assessment_mode text not null default 'ges_standard'
  check (assessment_mode in ('ges_standard', 'custom'));

comment on column public.schools.assessment_mode is
  'The assessment and grading framework the school uses: ges_standard (read-only GES/NaCCA preset) or custom (school-defined).';