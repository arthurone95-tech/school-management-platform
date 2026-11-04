# Assessment Framework Specification (Dual-Mode)

**Status:** Blueprint (authoritative for the dual-mode assessment framework)
**Branch:** feature/dual-mode-assessment-framework
**Date:** 2026-11-01

## 1. Purpose

Lock down the requirements for the school-level Assessment & Grading Framework so
that the implementation reads them as absolute law. Every school chooses between
two mutually exclusive modes:

1. **GES / NaCCA Standard Preset** (`ges_standard`) — default.
2. **Fully Custom Framework** (`custom`).

## 2. Modes

### 2.1 GES / NaCCA Standard Preset (default, read-only)

- Automatically provisions the complete standard class hierarchy: Crèche, Nursery
  1–2, KG 1–2, Basic 1–6, JHS 1–3.
- Official NaCCA subject groupings per class (`getSubjectsForClass`).
- Grading: 50% Class Score + 50% Exam Score; 9-point scale A1–F9; proficiency
  descriptors (High Proficiency 80–100, Proficient 70–79, Approaching Proficient
  50–69, Emerging 0–49); Creche developmental rubrics.
- Admins may "View" the read-only GES report card and grading structure but
  cannot modify core GES parameters.

### 2.2 Fully Custom Framework

- School configures custom classes, subjects, grade boundaries, and report-card
  layout preferences.
- All custom data is strictly scoped to the active `school_id` (RLS + server).
- Switching between modes cleanly isolates/activates the respective calculation
  engine without conflicting records or breaking past term reports.

## 3. Subject Mapping

`src/lib/school/subjects.ts` exports `getSubjectsForClass(className)` returning
`{ name, isHeading? }[]`, covering Creche, Nursery, KG, Basic 1–6, JHS 1–3.
Includes Computing, Ghanaian Language, French, RME, UCMAS and other applicable
subjects. `isHeading` marks categorized section headers.

## 4. Proficiency Remarks (exact boundaries)

- 80–100%: High Proficiency
- 70–79%: Proficient
- 50–69%: Approaching Proficient
- 0–49%: Emerging

## 5. Rankings

- Class position/rank per assessment (ordinal suffix: 1st, 2nd, 3rd, …).
- Subject-level student rankings within a class.

## 6. Printable A4 Terminal Report Card

`src/components/reports/TerminalReportCard.tsx` renders the traditional Ghanaian
terminal report format: school header, student info, class position, subject
performance table (class score, exam score, total, position, remarks), totals row,
attendance, conduct, attitude, interest, teacher remarks, head-teacher remarks,
promotion status, next-term bills breakdown, signatures. Print CSS via
`@media print`, single A4 page. Respects the active framework (GES read-only
layout vs custom layout).

## 7. Database & API

- `public.schools` gains `assessment_mode text check (assessment_mode in
  ('ges_standard','custom')) default 'ges_standard'`.
- `GET /api/staff/school/assessment-mode` reads the active mode for any staff
  member with `grade.read`; `POST` changes it and requires `school.manage`.
- The choice is saved immediately and the client re-renders without a page
  reload.

## 7a. Settings UX

School settings presents three sections in this order:

1. School profile
2. Academic years and terms
3. Assessment & grading framework

The assessment card is the only place the mode is chosen.

- **GES / NaCCA standard** is read-only. The card shows a collapsed
  “How the GES / NaCCA standard works” disclosure containing nested collapsed
  sections for the class hierarchy, Crèche, Nursery/KG, Basic 1–6, JHS 1–3,
  50/50 weighting, A1–F9 scale, proficiency remarks, rankings and the terminal
  report card. No subject or grade-band editors are rendered.
- **Fully custom** renders a small “Manage custom framework” link in the
  bottom-right of the same card. It opens the dedicated page
  `/dashboard/school/assessment`, which contains the subject manager and the
  grading-band manager, a page heading, save controls and a back link to school
  settings. Subjects and grade bands are never edited inline on the settings
  page.

The dedicated page is permission-gated: `subject.read`/`subject.manage` and
`grade.read`/`grade.manage` control visibility and editing. When the school is
on the GES preset, the page explains that custom configuration is inactive and
links back to the mode switch.

## 7b. Calculation routing

Result entries and report rendering delegate to the GES standard calculator or
the school's custom configuration based on `assessment_mode`.

## 7c. GES 50 + 50 results and terminal report cards

- `assessments.framework` is `ges_standard` or `custom`, defaulting to `custom`
  for existing records. GES assessments represent one official subject for a
  class and term, with `subject_id` null, `term_id` required, and `max_score`
  100.
- `assessment_results` stores `class_score` (0-50), `exam_score` (0-50) and a
  generated `total_score` (0-100) for GES records. The trigger in migration 0012
  makes the GES and custom result shapes mutually exclusive.
- `src/lib/school/ges-calculator.ts` is the canonical calculation engine:
  validation, totals, the A1-F9 scale, proficiency remarks, ordinal suffixes and
  competition ranking.
- `GET`/`POST /api/staff/results/ges` are gated by `assessment.read` and
  `result.record` respectively. `POST` also requires `assessment.manage` so that
  missing GES subject assessments can be created from the official
  `getSubjectsForClass` list on first use. The endpoint refuses to run unless the
  school is in `ges_standard` mode.
- The GES score-entry view loads the official subject list, enforces 50/50
  inputs, computes totals, grades, proficiency remarks and subject/class
  positions, and renders `TerminalReportCard` with the `TOTAL` row, next-term
  bills breakdown and signature/stamp blocks.
- Early-years classes (Crèche, Nursery, Kindergarten) show developmental
  rubrics and do not use the numeric 50 + 50 sheet.
- GES and custom records are never converted or deleted when a school changes
  mode.

## 8. Quality Gates

Run `npm run typecheck`, `npm run lint`, `npm test` after implementation. No
regressions to existing functionality.
EOF
Write-Output 'blueprint created'