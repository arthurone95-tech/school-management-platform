# Phase 0 Risk Register and Feasibility Findings

**Project:** School Management Platform\
**Document status:** Phase 0 deliverable — findings require owner review\
**Version:** 1.0\
**Date:** 2026-10-11

## 1. Purpose

This document records the Phase 0 deliverables of `docs/ROADMAP_AND_TESTING.md` 3: the validated stack, the initial risk list, and the initial test plan.

It does not change any confirmed decision, does not replace the roadmap, and does not add product requirements. Where it recommends a choice, that choice requires owner approval.

Everything marked **BLOCKING** must be resolved before Phase 1 begins.

## 2. Repository and Toolchain Inspection

| Item | State |
|---|---|
| Branch | `main` |
| Remote | `origin` → `github.com/arthurone95-tech/school-management-platform.git` (configured, nothing pushed) |
| Commits | 1 (`035c0c8 Initial commit`, containing only `.gitattributes`) |
| Tracked files | 1 |
| Untracked | All 14 project files: 4 agent instruction files, `opencode.json`, `docs/` (10 files) |
| `package.json` | Does not exist |
| Source code | None |
| Tests / CI | None |
| Migrations | None |
| `.env.example` | Does not exist |
| Node.js | v24.16.0 (installed) |
| npm | 11.13.0 |
| Git | 2.54.0.windows.1 |
| Paid services | None enabled. Supabase Free plan only, per D-015. |

The repository contains documentation only. No application has been built.

## 3. Stack Validation

### 3.1 Versions verified 2026-10-11

| Component | Finding | Source |
|---|---|---|
| Next.js | 16.3.8 is Active LTS (security release 2026-09-30); 15.5.27 is Maintenance LTS | nextjs.org September 2026 security release |
| Node.js requirement | 20.9 or later | nextjs.org installation docs |
| TypeScript requirement | 5.1 or later | nextjs.org |
| `@supabase/ssr` | v0.12.7 current; replaces deprecated `@supabase/auth-helpers-*` | supabase/ssr |
| Local Node.js | v24.16.0 satisfies the requirement | local |

### 3.2 Compatibility verdict

**Next.js with TypeScript is compatible with the confirmed Supabase direction.** Supabase maintains first-party SSR support for the Next.js App Router via `@supabase/ssr`, and PostgreSQL RLS works through the standard client. No concrete blocker was found in the framework/language pairing.

The blockers in section 4 are integration and configuration risks, not framework incompatibilities.

## 4. Risk Register

Severity follows `docs/ROADMAP_AND_TESTING.md` 8.

### R-01 — Next.js 16 renamed `middleware.ts` to `proxy.ts` — **BLOCKING**

**Severity:** High
**Evidence:** Supabase's server-side client guide states: *"On Next.js 15 and earlier, a `proxy.ts` file is never called, so sessions never refresh and users get signed out. Next.js renamed this file in version 16."*

**Impact:** If the session-refresh file is named `middleware.ts` on Next.js 16, it is never invoked. Sessions never refresh. Users are signed out roughly one hour after login, when the access token expires. The failure is silent — there is no error, and a quick local test that completes within the token lifetime will not reveal it. Older tutorials and most cached examples use the old name.

**Control:** On Next.js 16 the file must be `proxy.ts` at the project root. Confirm the file name and export against the installed Next.js major version before writing auth code, and add an explicit regression test that verifies token refresh occurs.

### R-02 — Single-use refresh tokens break under duplicate requests — **BLOCKING**

**Severity:** High
**Evidence:** `@supabase/ssr` documentation: *"Supabase refresh tokens are single-use. If two requests arrive simultaneously with the same expired session cookie (e.g. from two browser tabs opening at the same time), both will attempt a token refresh. The second request's refresh will fail... The second request will receive `session: null`."*

**Impact:** This directly conflicts with the confirmed low-connectivity requirement (D-008, `docs/PRD.md` 9.2). Users on slow or interrupted connections retry and reload more often, which raises the chance of concurrent requests carrying the same expired cookie. The user-visible result is an apparent random logout — the worst possible failure for adoption in the target market.

**Control:** Perform the refresh in one place per navigation (the proxy). Handle `session: null` from a failed concurrent refresh gracefully and retry or re-authenticate rather than treating it as a sign-out. Test the concurrent-refresh case explicitly.

### R-03 — Server-side authorization must never use `getSession()`

**Severity:** High
**Evidence:** Supabase documentation: *"Never trust `supabase.auth.getSession()` inside server code... It reads the session out of the cookie without revalidating it."*

**Impact:** Using `getSession()` for an authorization decision trusts an unvalidated, forgeable cookie. This would breach `docs/SECURITY_AND_PRIVACY.md` 7 and `docs/FEATURE_SPECIFICATIONS.md` 3 ("Resolve active membership and permissions on the server").

**Control:** See section 4.1 for the verified method selection.

### R-04 — Session cookies are chunked and persist on shared devices

**Severity:** Medium
**Evidence:** `@supabase/ssr` design documentation: browsers may not send cookies longer than 3180 bytes, so sessions are split into `.0`, `.1` … chunks; cookie `Max-Age` must be set very high so the browser retains them.

**Impact:** Two concerns. First, as user metadata or OAuth providers are added, the session grows and the number of chunks grows, which tightens an already small browser cookie budget on low-end devices. Second, a very long `Max-Age` means a session survives on a shared device after the user leaves — exactly the scenario `docs/SECURITY_AND_PRIVACY.md` 12 and `docs/PRD.md` 9.2 require us to handle.

**Control:** Keep user metadata minimal in the auth token (store roles in a protected table, not in `user_metadata`). Define and document the logout and session-expiry behaviour for shared devices before Phase 1 exit.

### R-05 — Next.js 16 development-server performance on local Node 24.16.0

**Severity:** Low
**Evidence:** Next.js 16.4 release notes: *"On Node.js 24.13.1 and newer, Next.js currently falls back to child processes due to a Node.js bug."*

**Impact:** Local development server is slower than it should be. The installed Node is 24.16.0, which meets this condition. Development-time only; no production or security impact.

**Control:** Accept for now, or pin local development to an LTS Node version. Not a blocker.

### R-06 — Supabase Free plan constraints during development

**Severity:** Low
**Evidence:** Supabase Free plan: 500 MB database, 5 GB egress, 2 active projects, and **projects pause after one week of inactivity**.

**Impact:** A returning developer may find the project paused and must restore it manually. Migrations applied to a Free project are applied to a disposable environment, so the migration workflow must be reproducible from version control rather than relying on the remote database as a source of truth. This is consistent with D-015, which already states the Free plan is not a production configuration.

**Control:** Migrations are the source of truth, never the remote database. Never treat Free-plan state as production-like. No paid service is to be enabled without owner approval (`AUTOMATION_WORKFLOW.md` 4D).

### R-07 — Repository has no baseline commit

**Severity:** Medium
**Evidence:** `git status` shows all 14 project files untracked; only `.gitattributes` is committed.

**Impact:** `docs/ROADMAP_AND_TESTING.md` Phase 1 requires a reproducible development setup and version-controlled migrations. Without a baseline commit there is no history to build on or revert to.

**Control:** Requires owner authorization. Committing is not covered by file-edit permission (`AGENTS.md` 15, `AUTOMATION_WORKFLOW.md` 4E).

## 5. Unresolved Decisions That Block Safe Progress

| ID | Decision | Status | Blocks |
|---|---|---|---|
| D-011 | Application framework (Next.js + TypeScript) | **Confirmed** 2026-10-11 | — |
| — | First end-to-end workflow | **Confirmed** — D-018, enrolment | — |
| — | Which school roles are required initially | **Open** (`docs/DECISIONS.md` 5) | **Blocks Phase 1** — required before enrolment authorization is implemented |
| — | Baseline commit approval | **Open** | **Blocks Phase 1** |
| — | RPO / RTO | **Open** (`docs/DATABASE_DOCUMENTATION.md` 11) | Production readiness only |
| — | Hosting provider | **Open** (D-013) | Deployment only |
| — | Supabase signing-key mode | **Unverified** — section 10.1 | Affects session method choice; verify at project creation |

None of these can be resolved by the agent. Each requires an owner decision.

## 6. First Workflow Recommendation

`docs/PRD.md` 7 lists the candidates and states the choice must not be assumed. This section presents a recommendation for the owner's decision; it is not a decision.

### 6.1 Candidate assessment

| Candidate | Assessment |
|---|---|
| **Student enrolment** (with class placement) | **Recommended.** Exercises every foundational requirement: authentication, school membership, permission check, a database write, RLS on insert and select, and a tenant-consistent relationship between a learner and a class. Self-contained, produces visible value on its own, and is a prerequisite for attendance, assessment and reporting. |
| Class assignment alone | A subset of enrolment. Does not create a learner record, so it cannot stand alone. |
| Attendance | Depends on enrolment existing first. Also the workflow most likely to require offline capture, which is a materially larger scope. Should follow, not lead. |
| Assessment records | **Not ready.** Grading rules differ between schools and `docs/PRD.md` 11 lists academic and grading differences as unvalidated. Building now would mean inventing rules. |
| Academic reporting | Depends on assessment records. Cannot lead. |

### 6.2 Recommendation

Build **student enrolment including class placement** as the first vertical slice.

It is the only candidate that is simultaneously valuable, sufficiently bounded, and capable of proving the tenant-isolation model end to end — which is the architectural assumption everything else depends on.

**Approved by the project owner on 2026-10-11 and recorded as D-018.**

### 6.3 Discovery questions the owner should answer first

From `docs/PRD.md` 7, unanswered and material to the choice:

1. Which administrative task causes the greatest recurring difficulty today?
2. How often is it performed, by whom, and who approves corrections?
3. What information is genuinely required at enrolment? (`docs/SECURITY_AND_PRIVACY.md` 4 requires data minimisation.)
4. What happens today when the internet fails during enrolment?
5. Which reports or exports depend on enrolment data?
6. Which roles perform enrolment, and which may correct it?

## 7. Initial Test Plan

This establishes the categories required by `docs/ROADMAP_AND_TESTING.md` 6 and 4. It does not replace the strategy in that document.

### 7.1 Stack and build
- Production build completes.
- Type checking passes.
- Linting passes.
- No privileged credential appears in the client bundle. Verify by inspecting the built output, not by assumption.

### 7.2 Authentication
- Sign-in, sign-out, and session expiry behave correctly.
- **R-01 regression:** the session-refresh file is invoked. Verified by observing a token refresh, not by the absence of an error.
- **R-02 regression:** concurrent requests with an expired session do not produce a spurious sign-out.
- Server-side authorization never relies on an unvalidated cookie read.

### 7.3 Tenant isolation — the controlling gate
Build on the matrix in `docs/ROADMAP_AND_TESTING.md` 5. Test at **both** the application layer and the database layer. A passing UI test is not evidence that RLS is correct.

Minimum fixtures: two schools, one user with membership in each, at least one non-member, and one revoked member.

- Member of School A can read permitted School A records.
- Member of School A is denied read, update and delete on School B records — at the application layer **and** through direct database access.
- A client-supplied school identifier does not grant access.
- A cross-school relationship is rejected by the database.
- A revoked membership loses access immediately, including through an existing session.
- A non-member is denied.
- A school administrator cannot reach platform administration.
- A user from one school cannot download another school's file.

### 7.4 Data integrity
- Duplicate enrolment submissions do not create duplicate learners.
- Required fields and relationships are enforced by the database, not only the form.
- Cross-school foreign-key relationships are rejected.
- Migrations apply cleanly to an empty database and are reproducible from version control.

### 7.5 Responsive and accessibility
- The workflow completes at representative mobile, tablet and desktop viewports with no unintended horizontal scrolling.
- Keyboard-only completion of the workflow.
- WCAG 2.2 Level AA checks per `docs/PRD.md` 9.3, with any exception recorded and justified.

### 7.6 Connectivity
- Loading, failure and retry states are clear.
- An interrupted request does not silently discard entered information.
- Retry of a write does not produce a duplicate record.

## 8. Cost Position

Development cost is zero. The Supabase Free plan is the only service in use, per D-015. No paid service is enabled, and none may be enabled without owner approval.

Costs that will arise later and are **not** committed: the production plan, point-in-time recovery, and any hosting provider. These are recorded as open in `docs/DECISIONS.md` and gated in `docs/PRD.md` 12.

## 9. Phase 0 Status

| Deliverable | Status |
|---|---|
| Approved initial workflow | **Complete** — D-018, student enrolment including class placement |
| Recorded unresolved decisions | Complete (section 5) |
| Confirmed implementation stack or documented alternative | **Complete** — D-011 confirmed, D-012 and D-015 already confirmed |
| Initial risk list and test plan | Complete (sections 4 and 7) |

Phase 0 exit criteria are met. Two follow-on decisions still block Phase 1 and are recorded in section 5: the school roles required for the first release, and approval of the baseline commit.

## 10. Appendices

### 10.1 Session verification method (verified 2026-10-11)

**No Supabase project has been created or configured.** The repository contains no `supabase/` directory, no `config.toml`, no `.env`, and no Supabase URL or key reference. No project configuration could therefore be inspected directly, and no credential was read.

The approach below is taken from current Supabase vendor documentation and is the documented default. It is **conditional** and must be verified against the actual project once one exists.

**Documented default approach**

- Use `supabase.auth.getClaims()` to verify identity on the server. This is the method Supabase's own Next.js guide specifies for protecting pages and data.
- Never use `getSession()` for a server-side authorization decision under any signing-key mode. It reads the cookie without revalidating.
- Use `getUser()` only where an authoritative user record is required, accepting one network round-trip per call.

**Why the signing-key mode changes the answer**

`getClaims()` verifies the JWT signature locally via Web Crypto against a cached JWKS **only when the project uses asymmetric signing keys**. On a project still using a symmetric secret it falls back to calling the Auth server, which is the same network cost as `getUser()`. Asymmetric signing keys have been the default for new Supabase projects since 1 May 2025, so a newly created project is expected to take the fast local path — but this is an expectation, not a verified fact about a project that does not yet exist.

This matters more than usual here: on slow or interrupted connections a per-request round-trip to the Auth server is the single largest avoidable latency cost, and `docs/PRD.md` 9.2 makes that environment a primary design constraint.

**Key model — time-sensitive**

Supabase is retiring the legacy `anon` and `service_role` keys in favour of publishable and secret keys. Vendor guidance indicates projects will be required to move away from the legacy keys in late 2026. Current environment variable names are therefore:

| Variable | Exposure |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public |
| `SUPABASE_SECRET_KEY` | **Server-only. Never `NEXT_PUBLIC_`. Never in the client bundle.** |

`.env.example` must use these names with placeholder values only, per `docs/SECURITY_AND_PRIVACY.md` 8.

**Must be verified when the project exists**

1. The project's signing-key mode is asymmetric, not a legacy symmetric secret.
2. Whether publishable and secret keys have been created, and whether any legacy `anon` / `service_role` keys still exist and should be revoked.
3. The project region, against the data-residency question left open in `docs/SECURITY_AND_PRIVACY.md` 5.
4. That the JWKS discovery endpoint returns a key for the project.
5. Auth email delivery and redirect URL configuration for invitations (D-018 requires enrolment roles to be invited).

None of this may be assumed. Record the verified result in `docs/DECISIONS.md` when it is known.
