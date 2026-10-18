# Roadmap and Testing Strategy

**Project:** School Management Platform\
**Document status:** Provisional delivery sequence\
**Version:** 1.1

## 1. Purpose

This document defines how the school management platform will be delivered incrementally and how implementation quality will be verified.

The objective is to establish a secure foundation, prove the most important architectural assumptions, and deliver working school workflows without attempting to implement the entire product at once.

The roadmap is provisional. Feature order must be reviewed against the PRD, feature specifications, risks, user feedback, and actual implementation findings.

## 2. Delivery Principles

Development must follow these principles:

- Inspect the existing repository before changing it.
- Confirm the intended scope before implementation.
- Build in small, verifiable increments.
- Prefer complete end-to-end workflows over disconnected feature screens.
- Treat tenant isolation and authorization as foundational requirements.
- Test negative and unauthorized access paths, not only successful cases.
- Validate dependencies, hosting compatibility, and cost before committing to them.
- Keep documentation and tests aligned with actual implementation.
- Do not claim completion without evidence.
- Do not expand scope without approval.

## 3. Proposed Delivery Phases

### Phase 0: Requirements and feasibility

Objectives:

- Review the PRD and feature specifications.
- Confirm the intended first workflow.
- Identify unresolved product and architecture decisions.
- Validate the proposed framework, database, hosting, and authentication capabilities.
- Estimate likely operating costs.
- Identify applicable privacy and security requirements.
- Define what constitutes a successful first release.

Deliverables:

- Approved initial workflow.
- Recorded unresolved decisions.
- Confirmed implementation stack or documented alternative.
- Initial risk list and test plan.

Exit criteria:

- The first workflow is clear.
- Critical architectural assumptions have been checked.
- No unresolved decision blocks safe implementation.

**Status 2026-10-12 (complete):** Phase 0 met its exit criteria. The first workflow is clear (D-018); critical architectural assumptions were checked **live** against the non-production dev project `school-management-dev` (`docs/PHASE0_RISK_REGISTER.md` 10.4); and the owner closed the remaining Phase 0 decision items on 2026-10-12 — initial roles (D-021: Platform Owner, School Administrator, Teacher, Student; Parent/Guardian deferred), proposed production recovery targets (D-022: RPO 24 h, RTO 24 h — **targets, not verified guarantees**), an interim learner-record retention framework (D-023), and hosting (D-013: development fixed on the local setup + `school-management-dev`; Vercel proposed for production). Production-only validations remain open and are tracked in `docs/PHASE0_RISK_REGISTER.md` 5 and `docs/DECISIONS.md`: production plan and actual-limit review and approval; backup capability / restoration test / cost verification against the D-022 targets; Vercel compatibility and cost validation; Ghanaian retention-law and school-obligation validation (D-023); and data-residency review — all before any real-school onboarding. No deployment, upgrade, or paid-service activation was performed.

### Phase 1: Secure project foundation

Objectives:

- Establish the repository structure and development workflow.
- Configure TypeScript, linting, formatting, and build checks as appropriate.
- Set up separate development and non-production environments.
- Configure authentication.
- Establish the initial database migration process.
- Implement the first tenant and membership authorization pattern.
- Enable and test required RLS policies.
- Establish safe secret handling.

Deliverables:

- Reproducible development setup.
- Initial database migrations.
- Authentication and membership foundation.
- Initial automated test setup.
- Documented environment configuration.

Exit criteria:

- The application builds successfully.
- Authentication works in the intended environment.
- Tenant-isolation tests demonstrate that unauthorized cross-school access is denied.
- No privileged secret is exposed to client code.

**Status 2026-10-12; updated 2026-10-15 (D-025):** the secure-foundation slice is implemented and verified **live** against the non-production dev project `school-management-dev` (Supabase, eu-west-1, Free plan), with the staff-invitation flow subsequently revised by D-025. Migrations `20261011000001` (enrolment foundation: 8 tables, RLS, policies, audit), `20261011000002` (sign-up guard Auth Hook) and `20261011000003` (role labels per D-021, `school_administrator`/`teacher`) plus `20261015000004` (staff invitations per D-025) are applied and recorded in `supabase_migrations.schema_migrations`. The build, type-check, lint, format and unit-test gates pass (124 tests). Live suites under `tests/live/` pass against the real project (`node tests/live/run-all.mjs` with the app running and a seeded project): auth mechanics (5), portal flow (22), tenant-isolation/RLS (15, including a revoked membership losing access through a live session), sign-up guard (4) and staff auth (44, D-025) — "All live checks passed." on 2026-10-15; the session-refresh checks R-01/R-02 (06/07) need the Management API token and were skipped in that run. Authentication (portal sign-in per D-020; staff sign-in per D-024), RLS enforcement, an observed token refresh through `proxy.ts`, and no privileged client exposure (production bundle scanned for secret values) are demonstrated; see `docs/PHASE0_RISK_REGISTER.md` 10.4. The **staff-auth live suite (`tests/live/09-staff-auth.mjs`) was rewritten for D-025** — a shareable `/join#token=…` activation link that sends no email, with preview, single-use accept (setting the password and confirming the email), revoke, re-invite and cross-school denial — and **its live re-run passed 44/44 on 2026-10-15** (migration `20261015000004` applied, app on `http://localhost:3100`); the earlier email-based staff-auth passes (25/35) exercised the `/auth/confirm` → `/join` routes that D-025 removed, so the previously recorded "real invitation-email click" open item is closed by design rather than outstanding. On 2026-10-14 the whole suite was re-run against a **production** build (`npm run build` + `npm start`), not only `next dev`, and passed end-to-end (portal 22, RLS 15, guard 4, staff auth 25, R-01 3, R-02 4); the root landing page was rewritten on 2026-10-14 to describe the implemented capabilities honestly (it had claimed the enrolment workflow was "not yet implemented"), and the R-02 concurrent-refresh assertion was made tie-tolerant for second-granular `exp` (section 10.4). On 2026-10-15 the project's migration history was confirmed to match the three then-local migrations (so a future `db push` skips rather than re-applies them). Still open for Phase 1 completion: a non-development environment for the same schema (deferred by decision — `school-management-dev` remains the working dev project); the Free-plan migration workflow via the Supabase CLI (migrations are currently applied through the Management API because `supabase link`/`db push` require the project database password — a user action; the CLI itself runs via `npx supabase@latest`, `supabase/README.md`); and the staff sign-in/staff-facing interface itself (Phase 2). Production readiness additionally requires the open validations in `docs/PHASE0_RISK_REGISTER.md` 5: production plan review and approval, backup/restoration/cost verification against the D-022 targets, Vercel compatibility and cost validation (D-013), and Ghanaian retention-law and school-obligation validation (D-023).

### Phase 2: First end-to-end school workflow

Select one workflow from the approved requirements. The exact workflow must be chosen before implementation rather than assumed by the agent.

The workflow should exercise the core architecture and include, where relevant:

- Authentication.
- Active school context.
- Membership and permission checks.
- A database read and write.
- Server-side validation.
- Database-level authorization.
- Loading, success, and error states.
- Automated tests.
- Responsive interface behavior.

Deliverables:

- A working vertical slice from user interaction through database persistence and back.
- Tests for both permitted and forbidden operations.
- Documentation of known limitations.

Exit criteria:

- The workflow works end to end in a non-production environment.
- Data ownership and authorization have been tested.
- Failure and retry behavior is understood.
- The user can verify the workflow without relying on unsupported claims.

**Status 2026-10-16 (D-026, D-027):** the section above now has two verified parts.

The **staff-facing slice** (D-024/D-025) is implemented: the staff sign-in page (`/sign-in`), the administrator dashboard (`/dashboard`) for creating, sharing, listing and revoking shareable invitations, and the read-only `GET /api/staff/invitations` endpoint behind it.

The **chosen workflow** — student enrolment including class placement (D-018) — is implemented as a vertical slice: `GET /api/staff/classes` (the class selector source), `GET /api/staff/learners` (a paged list with each student's current placement) and `POST /api/staff/learners` (register a student and create the initial placement in one request), behind the administrator-only Students page (`/dashboard/learners`). The workflow exercises authentication, the resolved active school, a permission check, database reads and writes, server-side validation, database-level authorization (Row Level Security on `classes`, `learners` and `learner_class_placements`, plus the composite foreign keys that keep a learner, a class and a placement in one school), and loading/empty/error/success states in a responsive interface.

Gates pass: format, lint, type-check, build (unit tests 151 at that point) and the live suites (`node tests/live/run-all.mjs`) including `10-staff-dashboard.mjs` (16 checks) and the new `11-enrolment.mjs` (23 checks: 401/403/400/409/201/200 paths, anonymous redirect and signed-in rendering of `/dashboard/learners`, cross-school denial, duplicate handling, username collision, and the persisted tenant-consistent placement). The exit criteria above are claimed **for this workflow only**; the other capabilities listed under Phase 3 were still unimplemented at this point (see the Phase 3 status below). Known limitations are recorded in D-027 (no single-call transaction across the two inserts; no placement change, deactivation or correction yet; the learner list is paged rather than fully searchable).

### Phase 3: Core school administration

After the first workflow is validated, implement approved foundational capabilities in a deliberate order.

Potential areas include:

- School profile and configuration.
- Academic years and terms.
- Classes and subjects.
- Staff membership and assignments.
- Learner records and enrollment.

These are candidate capabilities, not a commitment to implement all of them immediately.

Each capability must include its database constraints, authorization rules, UI states, and tests.

Exit criteria:

- The implemented capabilities work with tenant isolation.
- Related records cannot be improperly linked across schools.
- The main workflows have adequate automated and manual coverage.

**Status 2026-10-16 (D-028):** the first Phase 3 capability area — **learner records and enrollment**, together with **classes** — is implemented, under the owner-approved "Group A" scope.

Classes: `POST /api/staff/classes` (create) and `POST /api/staff/classes/update` (rename, deactivate, reactivate) behind the administrator-only `/dashboard/classes` page; `GET /api/staff/classes` gained `?includeInactive=true` for that page while the default stays active-only for the enrolment selector. A class is retired by deactivation, never deleted.

Learners: `POST /api/staff/learners/detail` (read one full record, including address and guardian contact), `POST /api/staff/learners/update` (partial correction), `POST /api/staff/learners/status` (deactivate/reactivate) and `POST /api/staff/learners/placement` (change class) behind the extended `/dashboard/learners` page; `GET /api/staff/learners` gained `?status` and now returns active students only by default, with the inactive records reached through the explicit view.

Tenant isolation and authorization: every write runs on the caller's **session client**, so Row Level Security (`classes_insert/update_managers`, `learners_update_managers`, `placements_update_managers`) and the composite foreign keys remain the enforcement point. Another school's class or student is a `404` (or a `400` for a class id on a placement change) — indistinguishable from a nonexistent one — and a teacher holds none of the required permissions (403).

Gates pass: format, lint, type-check, build, unit tests **174** (14 files; +5 PGlite tests for class-name uniqueness, the class update policy, the class audit trail and the `learners.status` constraint) and the live suites via `node tests/live/run-all.mjs`: the new `12-administration.mjs` (49 checks) alongside `03`/`04`/`05`/`09`/`10`/`11` (124 checks), **173 live checks** in total. The exit criteria are claimed **only for this capability set**. Known limitations: no single-call transaction across a placement change (the partial unique index `placements_one_current_per_learner` plus retry covers it); the learner list is paged rather than fully searchable; the Phase 3 candidates that need a migration — school profile and configuration, academic years and terms, subjects, and staff membership and assignments — remained unimplemented and blocked on a migration path at that point (no `SUPABASE_MGMT_TOKEN` / `SUPABASE_MGMT_PROJECT_REF`, no Supabase CLI in this environment). **Superseded by the D-029 status below.**

**Status 2026-10-16 (D-029):** the remaining Phase 3 candidate areas — **school profile and configuration**, **academic years and terms**, **subjects**, and **staff membership and assignments** — plus the staff **suspend / restore / revoke** workflow are implemented, under the owner-approved "all four areas, defaults" scope. This completes the five candidate areas listed for Phase 3. A Management API token made a migration path available, so the change is a real applied migration (`20261016000005_phase3_administration.sql`, applied and recorded in `school-management-dev`), verified by PGlite and live.

School profile: `GET /api/staff/school` and `POST /api/staff/school/update` (`school.manage`) let an authorized administrator rename the school; the school **code is immutable** because students use it to sign in (D-020). A new `schools_update_managers` policy is the boundary.

Academic years and terms: `GET`/`POST /api/staff/academic-years` plus `POST /api/staff/academic-years/update` (`academic.read` / `academic.manage`) create a year with a label and start/end dates, rename it, and mark exactly one **current** year (a partial unique index enforces one current year per school); `POST /api/staff/terms` and `/api/staff/terms/update` add and edit a year's terms. Dates are stored, never assumed from a hard-coded calendar.

Subjects: `GET`/`POST /api/staff/subjects` plus `POST /api/staff/subjects/update` (`subject.read` / `subject.manage`) create a subject with an optional code and an active flag. A subject is **retired by deactivation, never deleted**; the application exposes no delete path.

Staff membership and assignments: `GET /api/staff/members` (`member.manage`) lists the school's staff with their assignments (the member email is resolved through the server-only secret key, bounded to the memberships already read for the caller's school); `POST /api/staff/members/status` applies **suspend / restore / revoke**, following the D-023 learner pattern — a state change, never a hard delete, idempotent when the status is already in force, and audited by the `school_members` trigger. `POST /api/staff/assignments` and `/api/staff/assignments/delete` (`assignment.manage`) link a membership to a class and/or a subject behind `/dashboard/staff`.

Tenant isolation and authorization: every write runs on the caller's **session client**, so Row Level Security (the new permission-gated policies) and the composite foreign keys remain the enforcement point. Another school's year, term, subject, membership or assignment is a `404` (or a `400` when a cross-school class or subject id fails the composite foreign key), indistinguishable from a nonexistent one. Six new permissions (`academic.read`, `academic.manage`, `subject.read`, `subject.manage`, `assignment.read`, `assignment.manage`) are granted to `school_administrator` only; a teacher keeps none (D-021) and is refused (403). The new tables are not readable by the anonymous role.

Gates pass: format, lint, type-check, build, unit tests **219** (16 files; +45 for the administration request parsers and the PGlite database guarantees) and the live suites via `node tests/live/run-all.mjs`, including the new `13-administration-settings.mjs` (53 checks: anonymous refusal, the authorized reads and writes, validation, duplicates, the one-current-year rule, suspend/restore/revoke as state alone, cross-school denial, and the permission-less teacher). The exit criteria are claimed for the whole Phase 3 capability list. Known limitations: an administrator can revoke or suspend their own membership (no "last administrator" guard, mirroring the D-023 learner pattern); academic years, terms and subjects keep delete *policies* in the database (like `classes`) even though the application exposes no delete path, so a hard delete would have to be a deliberate direct database action and is audited.

### Phase 4: Teaching and academic workflows

Add only the academic capabilities approved for the release.

Potential areas include:

- Attendance.
- Assessments and results.
- Academic summaries and reports.
- Relevant teacher workflows.

Define grading, reporting, attendance, and academic-period rules from actual school requirements. Do not invent universal rules where schools may differ.

Exit criteria:

- Calculations and reports are validated against representative examples.
- Permissions prevent unauthorized access and changes.
- Records remain consistent when operations fail or are repeated.

**Status 2026-10-17 (D-030):** the first Phase 4 slice, **class attendance**, is implemented and verified live. The owner chose four defaults: statuses `present`/`absent`/`late`/`excused`; corrections same-day for a teacher and any-time for an administrator; no timetable (a register is a class + date + optional subject); and teachers take attendance for their assigned classes while administrators also get per-class reports. No offline capture, which `docs/PHASE0_RISK_REGISTER.md` had flagged as the larger part of this area.

**Teacher scope.** A teacher may reach only the classes they are assigned to through `staff_assignments`. This is enforced in the database by `can_access_class`, not only in the application: it is the predicate behind every attendance policy, so a write for any other class is refused. A teacher holds `attendance.read`/`attendance.record`/`attendance.correct` and still **no** `learner.read`, `class.read` or `subject.read`; the roster they mark comes from the gated `class_roster` function and exposes only id, registration number and name. `attendance.report` is administrator-only, so a teacher's attendance permissions never extend to the school-wide view.

**Records, not state.** Attendance has no delete path: no delete policy exists and `anon`/`authenticated` hold no `DELETE` grant. A register is corrected by re-submitting it whole (upsert by `(session_id, learner_id)`), and every change is audited with its actor. A partial submission is refused, because an incomplete register cannot be distinguished from a complete one.

Endpoints: `GET /api/staff/attendance/options`, `GET`/`POST /api/staff/attendance/sessions`, `GET`/`POST /api/staff/attendance/register`, `GET /api/staff/attendance/report`, and the `/dashboard/attendance` page.

Gates pass: format, lint, type-check, build, unit tests **285** (19 files; +66 for the attendance parsers, the shared date helpers and the PGlite attendance guarantees) and the live suites via `node tests/live/run-all.mjs`, all passing — including the new `14-attendance.mjs` (46 checks: anonymous refusal, the authorized flows, validation, duplicates, cross-school denial, the teacher class scope, the correction window, the report totals, and auditing) and the Management-API session-refresh checks 06/07, which were skipped in the previous run and ran here.

The exit criteria are claimed **for attendance only**. Assessments and results remain blocked on the unvalidated grading rules above, and academic summaries are limited to the per-class attendance report. Known limitations recorded in D-030: "today" is UTC rather than a configurable school timezone; nothing yet groups a report by term; there is no per-learner report page, no bulk import, and no offline capture.

**Status 2026-10-18 (D-031):** the second Phase 4 slice closes the remaining three areas — **assessments and results**, **academic summaries and reports**, and **relevant teacher workflows** — which completes the Phase 4 capability list.

The blocker was the documented grading gap: `docs/PRD.md` 11 records grading differences between schools as unvalidated, and the roadmap forbids inventing universal rules. It is resolved by making grading **school configuration rather than platform assumption**. `grade_bands` stores a school's own bands; a score's grade is the highest band it reaches; and **a school with no bands records marks and sees percentages with no grade**, which is the honest answer instead of an invented threshold. There is no default scale and no default pass mark.

- **Assessments** record a class, optionally a subject and term, a name, a positive maximum and a date; retired by deactivation, never deleted. A `check_result_score` trigger rejects a score above the maximum, because that ceiling lives in another table and a check constraint cannot express it.
- **Results** are records: no delete policy, no `DELETE` grant to `authenticated`, corrections are updates, and every change is audited. An absent row (never marked) and a null score (deliberately unmarked) are deliberately different things.
- **Teacher scope reuses `can_access_class`** from D-030 rather than adding a second rule, and the roster comes from the same gated `class_roster`, so marking needs no `learner.read`.
- **A band owns `[min, next min)` and creation refuses a band that would split an existing range**, which would silently regrade scores already recorded.
- **Permissions.** Administrator: all seven. Teacher: `assessment.read`, `assessment.manage`, `result.record`, `grade.read` — enough to teach and mark, and explicitly **not** `grade.manage`, `result.read` or `report.read`.
- **The class summary is an explicitly unweighted mean** of the marked percentages and reports `gradingIsConfigured: false` when no bands exist, rather than inventing a weighting rule.

Endpoints: `GET`/`POST /api/staff/grade-bands`, `POST /api/staff/grade-bands/update`, `GET`/`POST /api/staff/assessments`, `POST /api/staff/assessments/update`, `GET`/`POST /api/staff/results`, `GET /api/staff/reports/academic`, and `/dashboard/results`. Grading bands are managed on the existing `/dashboard/school` page, where school configuration already lives.

The **calculations and reports** exit criterion is met by 41 unit tests over the percentage and grade-boundary cases, checked against a representative Ghanaian scale, including the boundaries themselves and the no-bands-configured case. The **permissions** criterion is met by the PGlite suite plus the D-021 test, which now asserts the teacher's exact seven-permission set and that no administrator-only permission leaked in. The **consistency when operations fail or are repeated** criterion is met by whole-sheet submission (a partial sheet is refused, because it would look complete), upsert by `(assessment_id, learner_id)`, and the audit assertions. Known limitations recorded in D-031: no weighting, no position or rank, no per-assessment report card, no term-grouped summary, no moderation workflow, and no bulk mark import.

**Migration not applied.** `20261018000009_phase4_assessments.sql` is written and verified by unit tests and PGlite, but was deliberately **not applied** to the dev project during the autonomous session. Its live suite `tests/live/15-results.mjs` is written and registered, and skips with an explicit reason until the migration is applied. See `docs/AUTONOMOUS_SESSION_REPORT.md` sections E and G.

**Before this slice:** the dev project was found to hold an `attendance_sessions`/`attendance_records` schema recorded as `20261017000001_attendance.sql` with no source file in version control and weaker rules than approved (school-wide policies with no teacher class scope, no audit triggers, `DELETE` policies, no `attendance.report`). Both tables held zero rows; the owner authorised resetting it on 2026-10-17, and migrations `20261017000006`–`0008` replaced it. The seed cleanup in `tests/live/02-seed.mjs` was extended to delete attendance and the D-029 tables in dependency order, which it had not been doing.

### Phase 5: Additional modules and integrations

Add further approved modules when their requirements and dependencies are understood.

Possible areas include:

- Fees and payment integrations.
- Parent or guardian access.
- Notifications and announcements.
- File uploads and document management.
- Data import and export.
- Offline support for specifically selected workflows.

Payment, messaging, file storage, and offline features introduce additional security and operational requirements. Validate each one before enabling it.

Exit criteria:

- Each feature has a documented scope.
- External dependencies and costs are understood.
- Security, privacy, and failure behavior are tested.
- No module is enabled merely because its interface exists.

**Status 2026-10-18 (D-032):** the first Phase 5 slice — **data import and export** — is implemented, chosen because it is the highest-value item for a school that already exists and the only one that can be built honestly without external accounts.

**Import** (`POST /api/staff/import/learners`, `learner.import`) reads a learner's class list as CSV. Every row is validated by `parseEnrolmentInput` and written by `enrolLearner` — the same parser and operation the single-student form uses — on the caller's session client, so Row Level Security and the existing constraints apply unchanged and no new data path exists. Rows are validated independently and the response reports each row with its **file line number** and whether it was created. At most 100 usable rows per request.

**Export** (`GET /api/staff/export`, `learner.export` / `report.export`) produces the whole roll, or one class's attendance or results over a bounded window, as `text/csv` with `Cache-Control: no-store`. Export is gated on its own permission rather than on `learner.read`, because it carries addresses and guardian contacts out of the system, and every export is recorded in the audit trail **by the database** (`record_data_export`) with `auth.uid()` as the actor, so the actor cannot be omitted or supplied by the caller.

Safety details that matter: CSV quoting is handled properly (commas, doubled quotes, embedded newlines, CRLF) because real addresses contain them, and a leading spreadsheet formula character is neutralised on export because a child's name is untrusted input.

Gates pass: format, lint, type-check, build, unit tests **399** (23 files; +45 for the CSV/import rules and the PGlite data-exchange guarantees).

**Not implemented, and why.** Four of the six Phase 5 areas are recorded as deferred rather than half-built, because doing them badly would be worse than leaving them: **fees and payment integrations** need a provider account and create a financial commitment (`AUTOMATION_WORKFLOW.md` 4D); **parent or guardian access** needs a new external-facing role and a privacy decision that D-021 already deferred, and would give an external party access to children's records; **file uploads** need storage configuration that cannot be verified in this environment; **offline support** is rated a materially larger scope whose requirements `AUTOMATION_WORKFLOW.md` 9 says must not be decided independently. **Notifications and announcements** is the one remaining feasible item and is not built in this session.

The exit criteria are claimed **for data import and export only**. **Migration `20261018000010_phase5_data_exchange.sql` is written and locally verified but NOT applied** — see `docs/AUTONOMOUS_SESSION_REPORT.md` sections E and G. Known limitations: learners only, no update mode for an existing registration number, no dry run, no downloadable error report, and no column selection on export.

### Phase 6: Pilot and production readiness

Objectives:

- Test with a small, authorized pilot group.
- Validate usability on realistic devices and networks.
- Review performance with representative data.
- Verify backups and restoration.
- Review monitoring and incident procedures.
- Complete required privacy and legal checks.
- Fix release-blocking defects.

Exit criteria:

- Critical authorization and tenant-isolation tests pass.
- No known critical security issue remains unresolved.
- Recovery and operational procedures are documented and tested.
- The owner explicitly approves the production release.

**Status 2026-10-18: not started, and it cannot be started from this environment.** Every Phase 6 objective needs something outside the development environment, and claiming otherwise would be dishonest. The readiness assessment is in `docs/PRODUCTION_READINESS.md`; the short version:

- **What is demonstrably met.** Authorization and tenant isolation are covered by the live suite (RLS/isolation 15 checks, including a revoked membership losing access through an existing live session) and by the PGlite suites, which now assert 99 database-level checks across ten tables, four `SECURITY DEFINER` scope helpers and every permission boundary. No privileged secret appears in the production bundle.
- **What cannot be done here, and why.** A pilot needs a real, authorized school and real users. Backup and restoration must be tested against the D-022 targets (RPO 24 h, RTO 24 h) on the *chosen production provider's* plan, which is not configured. Vercel compatibility and cost are unvalidated (D-013). Performance has never been measured with representative data — there is no dataset larger than a seeded test school. Monitoring and incident procedures are documented but untested because no alerting exists. The Ghanaian privacy and retention review (D-023, `docs/SECURITY_AND_PRIVACY.md` 5) needs qualified advice, not an agent.
- **Two release-blocking prerequisites remain.** The three unapplied migrations (`20261018000009`, `20261018000010`) mean the assessments and data-exchange features are unverified end to end, and the origin of the unversioned `20261017000001_attendance.sql` is still unexplained.

Phase 6 is therefore correctly **not started**, and its exit criterion of "the owner explicitly approves the production release" is not one an agent can satisfy.

### Phase 7: Scale and improve

Use observed demand and evidence to determine what comes next.

Possible improvements include:

- Performance optimization.
- More detailed reporting.
- Improved import and export.
- Better accessibility and usability.
- Additional integrations.
- Stronger operational automation.
- Dedicated infrastructure for a school where justified.

Do not introduce complex scaling mechanisms before workload measurements or customer requirements justify them.

## 4. Testing Strategy

Testing must cover behavior, security, data integrity, and operational reliability.

### 4.1 Unit tests

Use unit tests for isolated business logic, validation rules, calculations, and utilities.

Examples include:

- Input validation.
- Permission decision helpers.
- Grade calculations where applicable.
- Date and academic-period rules.
- Formatting and data transformation.

Unit tests do not prove that database authorization works.

### 4.2 Integration tests

Integration tests must verify the interaction between application code and its dependencies.

Examples include:

- Authentication and membership resolution.
- Database operations and constraints.
- RLS policies.
- File storage authorization.
- Transaction and idempotency behavior.
- External integration callbacks.

Use a dedicated test environment with controlled data.

### 4.3 End-to-end tests

End-to-end tests should exercise important user journeys through the interface and application backend.

At minimum, cover:

- An authorized user completing the selected workflow.
- An unauthenticated user attempting to access a protected workflow.
- A user without school membership attempting access.
- A user from one school attempting to access another school's records.
- A user attempting an operation beyond their role.
- A recoverable failure and retry, where relevant.

Automated tests should not rely on production data.

### 4.4 Manual testing

Manual testing remains necessary for usability and operational behavior.

Check:

- Desktop and mobile layouts.
- Keyboard navigation.
- Accessible labels and focus behavior.
- Slow or interrupted network behavior.
- Clear success and error messages.
- School-context changes.
- Sensitive-action confirmations.
- Common browser behavior.

### 4.5 Regression testing

When fixing a defect, add or update a test that would detect the same defect in the future.

Run relevant regression tests after changes to shared authorization helpers, database policies, authentication, shared UI components, and common data-access code.

## 5. Tenant-Isolation Test Matrix

Maintain test users and records for at least two separate schools.

Verify the following:

| Test case                                                          | Expected result                        |
| ------------------------------------------------------------------ | -------------------------------------- |
| School A member reads permitted School A record                    | Allowed                                |
| School A member reads School B record                              | Denied                                 |
| School A member updates School B record                            | Denied                                 |
| School A member deletes School B record                            | Denied                                 |
| User without membership accesses a school's private records        | Denied                                 |
| User submits a forged school ID                                    | Denied unless independently authorized |
| User creates a relationship between records from different schools | Rejected                               |
| Revoked member attempts another protected operation                | Denied                                 |
| School administrator attempts platform-wide administration         | Denied unless separately authorized    |
| User downloads a file belonging to another school                  | Denied                                 |

Test both application-level authorization and direct database/API access paths that are exposed by the architecture.

Do not treat a successful frontend test as proof of RLS correctness.

## 6. Quality Gates

Before merging or considering a change complete, run the checks relevant to the repository and changed code.

These may include:

- Formatting.
- Linting.
- Type checking.
- Unit tests.
- Integration tests.
- End-to-end tests.
- Database migration validation.
- Production build.
- Dependency security checks.
- Manual verification for sensitive or visual changes.

Use the actual commands defined by the project. Do not invent test scripts and report them as having run.

If a check cannot be run because credentials, environment configuration, infrastructure, or tools are unavailable, state that limitation explicitly.

## 7. Definition of Done

A feature is complete only when:

- Its approved requirements are implemented.
- Authentication and authorization are enforced correctly.
- Input validation and data integrity rules are in place.
- Loading, empty, success, and error states are handled where relevant.
- Responsive behavior is adequate.
- Appropriate tests exist and have been run.
- Relevant documentation is updated.
- No known release-blocking defect remains.
- Any remaining limitation is recorded.
- Required approval has been obtained for consequential changes.

A page that renders without errors is not, by itself, a completed feature.

## 8. Defect Severity

Use a practical severity classification:

- **Critical:** confirmed or highly credible cross-school data exposure, privilege escalation, exposed privileged secrets, or serious integrity compromise.
- **High:** major workflow failure, unauthorized sensitive operation, or a defect likely to cause substantial data loss.
- **Medium:** significant feature malfunction with a workaround, or a substantial usability problem.
- **Low:** minor visual inconsistency, non-critical inconvenience, or cosmetic defect.

Severity must reflect actual impact and evidence. Record uncertainty where the impact has not been confirmed.

Critical security issues must block production release until resolved or formally addressed through an explicitly approved risk decision.

## 9. Progress Reporting

After each implementation task, report:

- What changed.
- Why it changed.
- Files added, modified, or removed.
- Tests and checks actually run.
- Results and relevant evidence.
- Known limitations or unresolved issues.
- Risks or decisions requiring owner approval.
- Exact actions the owner must take, if any.

Separate verified results from assumptions and plans.

Never claim that a deployment, integration, migration, test, or security review succeeded unless it has actually been completed and verified.

## 10. Scope Control

Do not implement every feature in the PRD in one large operation.

Before each phase:

1. Confirm the target outcome.
2. Identify dependencies.
3. Define acceptance criteria.
4. Identify security and data risks.
5. Agree on the implementation scope.
6. Implement and test that scope.
7. Review the result before proceeding.

If implementation reveals a material architecture, cost, legal, or security issue, stop the affected work and present the evidence and options before making a consequential change.

## 11. Final Release Gate

A production release requires verified authorization, tenant isolation, data integrity, privacy safeguards, operational recovery, and an approved scope.

The roadmap is complete only when the delivered system meets the acceptance criteria for the agreed release, not when every possible feature has been attempted.
