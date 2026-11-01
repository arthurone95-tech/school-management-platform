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
- Settings toggle in `src/app/dashboard/school/` persists the choice.
- Calculation routing: result entries and report rendering delegate to the GES
  standard calculator or the school's custom configuration based on
  `assessment_mode`.

## 8. Quality Gates

Run `npm run typecheck`, `npm run lint`, `npm test` after implementation. No
regressions to existing functionality.
EOF
Write-Output 'blueprint created'