# Production Readiness Assessment

**Project:** School Management Platform\
**Document status:** Readiness assessment, not an approval\
**Assessed:** 2026-10-18\
**Updated:** 2026-10-31 (migrations applied, framework upgraded, live suite re-run)\
**Assessed by:** automated session (no owner involvement)

## 1. Purpose

This document records how ready the platform is to be piloted or released, item
by item against `docs/ROADMAP_AND_TESTING.md` Phase 6 and the Final Release Gate
(section 11). It exists so the owner can see **what is proven, what is not, and
what only they can do** without re-deriving it from the test output.

It is deliberately conservative. A readiness document that overstates confidence
is worse than none, because it moves a decision the owner has to make onto a
checklist they assume has been verified.

## 2. Summary

**Verdict: not ready for a pilot or production release.** No critical security
defect is known, and the authorization foundation is well evidenced. What is
missing is not code quality — it is anything that requires a real user, a real
provider, real data volume, or a legal opinion.

| Area | State | Evidence |
| --- | --- | --- |
| Authorization and tenant isolation | **Proven** | Live suite (RLS/isolation 15, cross-school denial in every staff suite) and 99 PGlite database checks |
| Authentication and session handling | **Proven** | Live staff auth 44, portal 22, session refresh R-01 3/3, concurrent refresh R-02 4/4 |
| Secret handling | **Proven** | Production bundle scanned for secret values (`tests/live/08-no-secrets-in-bundle.mjs`); secret values never printed or committed |
| Build and quality gates | **Proven** | On Next.js 16.4.3: format, lint, type-check, build and 399 unit tests pass; live steps 02–14 and results step 15 (47/47) pass. Steps 06/07 were skipped because no Management API token was supplied |
| Feature completeness (Phases 0–4) | **Complete** | Roadmap status paragraphs for each phase |
| Data exchange (Phase 5 slice) | **Built, not live-verified** | Unit + PGlite tests pass; migrations applied 2026-10-31, but no live import/export suite exists |
| Backups and restoration | **Not started** | Requires the production provider's plan |
| Performance with real data volume | **Not measured** | Largest dataset is a seeded test school |
| Monitoring and incident response | **Documented, untested** | No alerting configured |
| Privacy and legal review | **Not started** | Requires qualified advice (D-023) |
| Pilot with real users | **Not started** | Requires a real authorized school |
| Hosting plan validation and cost | **Not started** | Vercel proposed but unvalidated (D-013) |

## 3. What is genuinely evidenced

### Authorization and tenant isolation

This is the foundation the whole product rests on, and it is the best-evidenced
area. Three layers are separately tested:

1. **Application layer.** Every staff route resolves the caller's verified
   session, their single active school, and the permission the operation needs,
   through one shared helper (`src/lib/server/school-access.ts`), so the sequence
   cannot diverge between routes.
2. **Database layer.** Row Level Security on every tenant-owned table. The live
   suite confirms a member whose membership is revoked loses access immediately
   through an existing session, and that a cross-school read returns nothing, a
   cross-school update touches zero rows, and anonymous access is refused at the
   grant before RLS is even reached.
3. **Scope layer.** Four `SECURITY DEFINER` helper functions
   (`can_access_class`, `can_access_assessment`, `can_access_attendance_session`,
   `class_roster`) confine a teacher to the classes they are assigned to. This is
   the reason a teacher can take attendance and mark work without holding
   `learner.read`, and it is asserted negatively in the PGlite suites: a teacher
   cannot read, insert or update outside their assigned classes even within their
   own school.

**No critical security issue is known.** That statement is bounded: it means no
such issue has been found and tested for, not that none exists. `docs/DECISIONS.md`
and `docs/PHASE0_RISK_REGISTER.md` carry the open risks.

### Records that cannot be silently destroyed

Following D-023, attendance, results, memberships and learners are corrected by
state change, never by deletion:

- `attendance_records`, `assessment_results` and `learner_portal_credentials` have
  **no delete policy** and no `DELETE` grant to any authenticated role.
- `learners.status`, `school_members.status`, `subjects.is_active` and
  `assessments.is_active` carry the lifecycle instead.
- Every change is written to `audit_events` by a database trigger, with the
  verified caller as the actor.

## 4. What is not evidenced, and why

### Applied migrations (2026-10-31)

The two outstanding migrations were applied to the dev project in order and
recorded in `supabase_migrations.schema_migrations`:

- `20261018000009_phase4_assessments.sql` (assessments, results, grade bands)
- `20261018000010_phase5_data_exchange.sql` (import/export permissions and the
  export audit function)

The schema is present (`grade_bands`, `assessments`, `assessment_results`), and
the assessments/results slice is now verified live: `tests/live/15-results.mjs`
passed 47/47 against the production build. The Phase 5 import/export endpoints
still have **no live suite**, so they remain verified by unit and PGlite tests
only. `tests/live/run-all.mjs` still skips step 15 when the Management API token
is absent; it was run directly after steps 02–14.

### An unexplained migration in the dev project

The dev project contained an `attendance_sessions`/`attendance_records` schema
recorded as `20261017000001_attendance.sql` with **no source file anywhere in
version control** — no branch, no stash, no worktree — and with weaker rules than
the approved design. It held zero rows and was reset with owner approval on
2026-10-17. **Its origin is still unexplained.** Until it is understood, there is
a risk that some other process is writing to the environment, and a second
environment built from `supabase/migrations/` alone would not reproduce what the
dev project contained.

### Performance

No performance work has been done, and the platform has never been loaded with
representative data. A school with 800 learners and 5 years of attendance is the
case that matters, and the following are all unmeasured: the paged learner list
against a full roll, a class report with many assessments, a CSV export of the
whole roll, and a 100-row bulk import on a slow connection. The bounds exist
(`EXPORT_MAX_ROWS`, `ATTENDANCE_MAX_RECORDS`, `IMPORT_MAX_ROWS`) but their
*headroom* is untested. This is a genuine risk, not a formality.

### Backups and restoration

D-022 records RPO 24 h and RTO 24 h as **targets, not verified guarantees**. No
backup has been configured, and no restoration has been attempted. This must be
tested against the production provider's actual plan, because point-in-time
recovery cost and retention differ by tier, and a 24 h RPO is not achievable on a
plan without it.

### Monitoring and incident response

`docs/DEPLOYMENT_AND_OPERATIONS.md` documents the operational model, but no
monitoring, alerting or error reporting is configured. Nothing would currently
tell anyone that the application is down, that a school is being denied access, or
that a background operation failed.

### Privacy and legal

`docs/SECURITY_AND_PRIVACY.md` 5 requires an assessment of the Ghana Data
Protection Act, 2012 (Act 843) with qualified advice. That has not happened and
cannot be done by an agent. D-023's retention framework is an *interim* position.
Before any real child's data enters the platform, this is the item with the
largest consequence if it is wrong.

## 5. Release-blocking prerequisites

In order:

1. **Complete live verification of data exchange.** Migrations `0009`/`0010`
   are applied and results step 15 passes 47/47, but the Phase 5 import/export
   endpoints still need a live suite.
2. **Resolve the unexplained migration** origin. If another process created it,
   find out what and whether it still runs.
3. **Confirm the school-defined grading approach** (D-031) with a real school's
   requirements. Every report and grade depends on it.
4. **Legal and privacy review** before any real child's data is entered.
5. **Backups configured and a restoration tested** against D-022 targets on the
   production plan.
6. **A pilot school identified, authorized, and briefed**, with a written scope
   for what they may and may not do.
7. **Manual testing** on real devices and networks (`docs/ROADMAP_AND_TESTING.md`
   4.4). Automated tests do not cover a phone on a poor connection, and the
   attendance and marking flows are exactly where that matters.
8. **Owner approval of the production release**, which is the Phase 6 exit
   criterion and not an agent's to satisfy.

## 6. Outstanding operations

### Re-run live verification (development project only)

The migrations are already applied. The linked Supabase CLI records them, so a
repeat push is a no-op:

```sh
npx supabase@latest db push --linked --dry-run
```

Build and start on a free port (3000 may belong to another project), then run
the suite:

```sh
npm run build
npm run start -- -p 3100
$env:LIVE_APP_URL = "http://localhost:3100"
node tests/live/run-all.mjs
node tests/live/15-results.mjs
```

`run-all.mjs` skips steps 06/07 and step 15 when the Management API token is not
set. Running `15-results.mjs` directly after steps 02–14 exercises the results
slice; it passed 47/47 on 2026-10-31. To include 06/07, also set
`SUPABASE_MGMT_TOKEN` and `SUPABASE_MGMT_PROJECT_REF`.

## 7. What is deliberately not claimed

- Not "secure". No such claim can be made from a passing test suite
  (`docs/ROADMAP_AND_TESTING.md` 5, "Do not treat a successful frontend test as
  proof of RLS correctness").
- Not "compliant". No legal review has been performed.
- Not "performant". Nothing has been measured under load.
- Not "recoverable". No restoration has been tested.
- Not "verified in production". Nothing has been deployed, and no production
  environment exists.