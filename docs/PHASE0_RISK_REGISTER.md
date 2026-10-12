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
| Next.js | **Installed: 16.4.0** (owner confirmed 2026-10-11, retained over 16.3.8). 16.3.8 was Active LTS (security release 2026-09-30); 15.5.27 is Maintenance LTS | local `package.json`; nextjs.org September 2026 security release |
| Node.js requirement | 20.9 or later | nextjs.org installation docs |
| TypeScript requirement | 5.1 or later; local 5.9.3 | nextjs.org; local |
| `@supabase/ssr` | v0.12.7 current; replaces deprecated `@supabase/auth-helpers-*` | supabase/ssr |
| Local Node.js | v24.16.0 satisfies the requirement | local |
| React | 19.3.0 installed; bundled with the Next.js 16.4.0 scaffold | local |

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

**Status 2026-10-12:** **verified live** — `tests/live/06-refresh-session.mjs` temporarily shortens the project's `jwt_exp` to 60 s via the Management API, signs in through the portal, waits for the access token to expire, then observes an actual rotation through `proxy.ts` (new `exp`, rotated cookie) against the real project; the original `jwt_exp` is restored afterwards (3/3 PASS, section 10.4).

### R-02 — Single-use refresh tokens break under duplicate requests — **BLOCKING**

**Severity:** High
**Evidence:** `@supabase/ssr` documentation: *"Supabase refresh tokens are single-use. If two requests arrive simultaneously with the same expired session cookie (e.g. from two browser tabs opening at the same time), both will attempt a token refresh. The second request's refresh will fail... The second request will receive `session: null`."*

**Impact:** This directly conflicts with the confirmed low-connectivity requirement (D-008, `docs/PRD.md` 9.2). Users on slow or interrupted connections retry and reload more often, which raises the chance of concurrent requests carrying the same expired cookie. The user-visible result is an apparent random logout — the worst possible failure for adoption in the target market.

**Control:** Perform the refresh in one place per navigation (the proxy). Handle `session: null` from a failed concurrent refresh gracefully and retry or re-authenticate rather than treating it as a sign-out. Test the concurrent-refresh case explicitly.

**Status 2026-10-12:** **verified live** — `tests/live/07-concurrent-refresh.mjs` fires two simultaneous requests with the same expired session cookie; both are served (200/200), both rotate the token (GoTrue's refresh reuse handling absorbs the race), and a follow-up navigation with the rotated cookie refreshes again — no spurious sign-out (4/4 PASS, section 10.4). The failed-refresh path in `src/lib/supabase/session.ts` passes the request through without writing cookies (never clearing the session); in this run both concurrent requests succeeded, so that specific interleaving was not separately observed.

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

**Resolved 2026-10-11:** the documentation baseline was committed locally as `2bca391` and not pushed. Phase 1 must create a `.gitignore` before dependencies are installed or the application is scaffolded.

### R-08 — Student sign-in uses a synthetic auth identity in a reserved namespace

**Severity:** Medium
**Evidence:** D-020 (approved 2026-10-11). Supabase Auth requires an email- or phone-shaped identity for a permanent account; the approved design stores each student account against an opaque identifier in the RFC 2606 `.invalid` domain and ships a server-mediated school-code + username sign-in path.

**Impact:** Two risks. First, if Supabase's email validator rejects the reserved namespace, or if a signing-up user can create accounts in it, the namespace could be unusable or abusable. Second, the `(school code, username)` resolution path is a new authentication surface: if it leaks whether an account exists, or is not rate-limited, it becomes an enumeration and brute-force target.

**Control:** Before the portal slice is implemented, verify against a real project that (a) the chosen namespace passes Supabase email validation, (b) email flows are disabled for these accounts, and (c) a `Before User Created` Auth Hook rejects sign-ups that do not originate from the trusted server path. Rate-limit the resolution path and return a uniform failure that does not disclose whether the school code, username or account exists. Unit-test normalisation and resolution logic where it is pure.

**Resolved 2026-10-12:** all controls verified against the live dev project (section 10.4): (a) `students.invalid` is accepted by GoTrue for server-provisioned accounts; (b) public sign-up is disabled (`disable_signup = true`) and the `Before User Created` Auth Hook refuses any sign-up the platform server did not stamp (`app_metadata.provisioned_by`); (c) the sign-in path is rate-limited by IP and identity and returns a single uniform failure for a wrong school code, username or password. The hook runs on the sign-up path only; the service-role admin API does not pass through it and is protected by the secret key never leaving the server.

### R-09 — Refreshed session responses must not be cached by a CDN or proxy

**Severity:** High (if misconfigured)
**Evidence:** `@supabase/ssr` documentation (2026-10-11): the cookie `setAll` callback receives `Cache-Control`, `Expires` and `Pragma` headers that **must** be applied to the response; otherwise a shared cache can store a response carrying a `Set-Cookie` for one user and serve it to another, signing the second user in as the first.

**Impact:** Cache poisoning of authenticated responses can cause cross-user session leakage — a tenant-isolation and account-takeover class defect.

**Control:** Apply the cache headers returned by `setAll` in the Next.js `proxy.ts` and in any route handler that refreshes a session. Never cache authenticated responses or per-school data in a shared cache. Review `cacheComponents` and framework caching defaults before introducing authenticated pages (see `docs/PHASE0_RISK_REGISTER.md` 10.2).

## 5. Unresolved Decisions That Block Safe Progress

| ID | Decision | Status | Blocks |
|---|---|---|---|
| D-011 | Application framework (Next.js + TypeScript) | **Confirmed** 2026-10-11 — installed 16.4.0 | — |
| D-020 | Student portal authentication approach | **Confirmed** 2026-10-11 (school code + username over an internal non-deliverable identifier) | Portal slice only; see R-08 |
| — | First end-to-end workflow | **Confirmed** — D-018, enrolment | — |
| — | Which school roles are required initially | **Resolved 2026-10-12** — D-021: Platform Owner, School Administrator, Teacher and Student; scope and school boundary per role in `docs/DECISIONS.md`. Parent/Guardian access deferred (E5 resolved) | Authorization may reference the four approved role labels; permission assignments remain feature-driven via the permission catalogue |
| — | Baseline commit approval | **Resolved 2026-10-11** — documentation baseline committed as `2bca391` | — |
| — | RPO / RTO | **Resolved as proposed targets 2026-10-12** — RPO 24 h, RTO 24 h (D-022); targets, not verified guarantees. Backup capability, a non-production restoration test and cost verification are **mandatory production-readiness tasks** | Production readiness only |
| — | Hosting provider | **Resolved for development 2026-10-12** — local Next.js + the existing `school-management-dev` Free project; **Vercel recorded as the proposed production option** (D-013), subject to compatibility and cost validation. Production requires a separately configured environment with backup, security, privacy and cost verified | Deployment only |
| — | Learner retention / permanent-deletion policy | **Resolved 2026-10-12 as an interim framework** — D-023: no permanent deletion merely because a student leaves (leaving is recorded by enrolment state); access to inactive records is restricted; sensitive actions are audited; no retention period is invented. Ghanaian legal and school-specific obligations are **items requiring validation before real-school onboarding** | Production onboarding only |
| — | Supabase signing-key mode | **Verified 2026-10-12** — asymmetric (the project JWKS returns an EC key), so `getClaims()` takes the local verification path (section 10.4) | — |
| — | Supabase project creation | **Created and configured 2026-10-12** — non-production dev project `school-management-dev` (eu-west-1, ACTIVE_HEALTHY, Free plan as created). Migrations 0001 and 0002 applied and recorded in `supabase_migrations.schema_migrations`. Live verification results in section 10.4 | — |

Any item still unresolved in this table requires either an owner decision or production-readiness validation; no remaining row blocks Phase 1 implementation.

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

Costs that will arise later and are **not** committed: the production plan, point-in-time recovery, and the production application-hosting option (Vercel proposed, D-013). These remain gated in `docs/PRD.md` 12. Cost verification of the production plan, recovery capabilities and the hosting option is a mandatory production-readiness task (D-022); development remains zero-cost on the Free plan (D-013, D-015).

## 9. Phase 0 Status

| Deliverable | Status |
|---|---|
| Approved initial workflow | **Complete** — D-018, student enrolment including class placement |
| Recorded unresolved decisions | Complete (section 5) |
| Confirmed implementation stack or documented alternative | **Complete** — D-011 confirmed, D-012 and D-015 already confirmed |
| Initial risk list and test plan | Complete (sections 4 and 7) |
| Live validation of the secure foundation | **Complete 2026-10-12** — migrations applied to and recorded on `school-management-dev`; auth mechanics (5), portal flow (22), tenant-isolation/RLS (15), sign-up guard (4), session refresh R-01 (3) and concurrent refresh R-02 (4) live checks pass (section 10.4) |
| Phase 0 test-plan closeout | **Complete 2026-10-12** — revoked membership loses access immediately through a live session (7.3); token refresh observed through `proxy.ts` (7.2 / R-01); concurrent refresh without spurious sign-out (7.2 / R-02); no server-only secret in the production build output, verified by scanning `.next/` (7.1). Items that need a UI or features that do not exist yet — sign-out/session-expiry behaviour (7.2), platform administration and cross-school file download (7.3), responsive/accessibility (7.5) and connectivity (7.6) — are tracked for Phase 1 |
| Owner decision items (roles, RPO/RTO, retention, hosting) | **Complete 2026-10-12** — D-021 (initial roles and boundaries), D-022 (proposed recovery targets), D-023 (interim retention framework), D-013 (hosting: development fixed, Vercel proposed for production) |

Phase 0 exit criteria are met: the first workflow is clear (D-018); critical architectural assumptions have been checked live against the non-production dev project (section 10.4); and no unresolved decision blocks safe implementation — the owner closed the remaining section 5 decisions (roles, RPO/RTO, retention, hosting) on 2026-10-12 (D-013, D-021, D-022, D-023). Production-only validations remain open and are tracked here and in `docs/DECISIONS.md`: review and approval of the production plan and its actual limits; backup capability / restoration test / cost verification against the proposed RPO 24 h / RTO 24 h targets (D-022); Vercel compatibility and cost validation (D-013); Ghanaian retention-law and school-obligation validation (D-023); and data-residency review — all before any real-school onboarding. Development continues on the Free plan with test data and remains non-production (D-015).

## 10. Appendices

### 10.1 Session verification method (verified 2026-10-11)

> **Superseded 2026-10-12:** a non-production project (`school-management-dev`) now exists and every item this section marked "must be verified when the project exists" has been verified — see section 10.4. This section remains as the historical record of the pre-project analysis.

**No Supabase project has been created or configured, and no credential has been read.** As of 2026-10-11 the repository contains the client foundation (`src/lib/supabase/` and `src/proxy.ts` for session refresh — R-01, R-09) and the first schema migration (`supabase/migrations/20261011000001_enrolment_foundation.sql`, see section 10.3). There is still no `supabase/config.toml`, no `.env`, and no Supabase URL or key value, and nothing has been applied to any project. No project configuration could therefore be inspected directly.

The proxy fails loudly in production when the public configuration is missing, and passes through in development so the local scaffold remains usable before a project exists. This was verified by running the production build with and without configuration.

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
| `PORTAL_CREDENTIAL_SECRET` | **Server-only.** Keys the HMAC that hashes one-time activation and reset credentials (`docs/ENROLMENT_PERMISSION_MODEL.md` 8.2). Never `NEXT_PUBLIC_`. |

`.env.example` must use these names with placeholder values only, per `docs/SECURITY_AND_PRIVACY.md` 8.

**Verified key behaviour 2026-10-12 (details in section 10.4):** with the scoped platform token, the Management API returns the legacy `anon` and `service_role` keys in full, but masks the newer `sb_secret_…` values because the token lacks **API Key Secrets (Read)**. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` therefore holds the publishable key (maps to the `anon` role) and `SUPABASE_SECRET_KEY` currently holds the legacy `service_role` JWT. Granting the token "API Key Secrets (Read)" would allow switching `SUPABASE_SECRET_KEY` to the `sb_secret_…` key.

**Must be verified when the project exists**

1. The project's signing-key mode is asymmetric, not a legacy symmetric secret.
2. Whether publishable and secret keys have been created, and whether any legacy `anon` / `service_role` keys still exist and should be revoked.
3. The project region, against the data-residency question left open in `docs/SECURITY_AND_PRIVACY.md` 5.
4. That the JWKS discovery endpoint returns a key for the project.
5. Auth email delivery and redirect URL configuration for invitations (D-018 requires enrolment roles to be invited).

None of this may be assumed. Record the verified result in `docs/DECISIONS.md` when it is known.

### 10.2 Next.js caching posture (reviewed 2026-10-11)

`next.config.ts` retained the scaffold defaults `cacheComponents: true` and `partialPrefetching: true`. This review records the security posture for caching before any authenticated page is introduced.

- **`cacheComponents`** makes caching explicit: in a Cache-Components app, data is dynamic by default and is only reused across requests when a component or function is explicitly marked with `"use cache"` (optionally with `cacheLife`/`cacheTag`). This is a safer default than implicit caching, because a reviewer can see every cache boundary in the source.
- **Rule:** per-school or authenticated data must never be marked with `"use cache"` unless the cache key includes the tenant (school) and is invalidated on membership, role or session change. No authenticated data is cached in a shared cache by default.
- **Session responses:** the cookie `setAll` callback in `proxy.ts` and any session-refreshing route handler must apply the `Cache-Control`, `Expires` and `Pragma` headers it receives, and must return the response that carries the refreshed cookies (see R-09). This is the specific mechanism that prevents a proxy/CDN from caching one user's `Set-Cookie` and serving it to another.
- **Not yet verified:** there are no authenticated pages at this stage, so this posture has not been exercised against real sessions. It must be re-verified with an authenticated request when the authentication foundation lands, and covered by a regression test once a Supabase project exists.

### 10.3 Local database verification with a WASM PostgreSQL (2026-10-11)

The first migration, `supabase/migrations/20261011000001_enrolment_foundation.sql` (the enrolment slice at `docs/DATABASE_DOCUMENTATION.md` 8), is verified locally without a Supabase project using PGlite (`@electric-sql/pglite`), a WASM build of PostgreSQL run from the test suite. `tests/database/` boots a fresh database, recreates the small part of the Supabase environment the migration depends on (`anon`, `authenticated` and `service_role` roles, `auth.users`, and an `auth.uid()` reading the request JWT subject), applies the migration, then asserts the security invariants:

- RLS is enabled on all eight tenant-owned tables, and the credential table has no client policy.
- A school administrator and a staff member each see only their own school's learners; an authenticated user with no membership and an anonymous request see nothing.
- An insert naming another school's id is refused by the RLS `WITH CHECK`.
- A learner from one school cannot be placed in another school's class (composite foreign key).
- A learner cannot be hard-deleted, and a second open placement for one learner is refused.
- Enrolment creates and edits write audit events naming the acting user, recording changed column names only (never personal values), and those events cannot be written or erased from an authenticated session.
- Portal credentials are reachable only through the server-only role, and a suspended membership loses access immediately.

**What this does not prove.** PGlite is not Supabase. It does not exercise GoTrue, the `Before User Created` Auth Hook, publishable/secret key behaviour, asymmetric signing keys, Supabase's deployed default grants, the Free-plan connection pooler, or the Auth schema as provisioned. Those remain outstanding and must be verified against the non-production project when it is authorised. Passing these tests is evidence of policy logic, not proof that the deployed database is configured as intended.

### 10.4 Live verification against the non-production project (2026-10-12)

**Project.** `school-management-dev` — ref `ysjumhlyqhoobywgqand`, region **eu-west-1**, status **ACTIVE_HEALTHY**, organisation `lztyidujzngnijpsawbf`. Free plan as created; the scoped token is not granted `projects_read`, so plan value is recorded from creation rather than re-read from the list endpoint. The token reaches **only** this project: fake or other refs return 404.

**Migrations applied and recorded.** `20261011000001_enrolment_foundation.sql` (8 tenant tables, RLS, policies, audit trigger, portal-credential store) and `20261011000002_portal_signup_guard.sql` (sign-up guard hook) were applied in single transactions via the Management API and recorded in `supabase_migrations.schema_migrations` (version, statements, name), so a future CLI adoption will not re-apply them. The CLI is not used (no `supabase/config.toml`).

**Key behaviour (token limitation, worked around).** The publishable key works for the `anon` role. The Management API returns the legacy `anon`/`service_role` keys in full, but **masks** the newer `sb_secret_…` values because the token lacks *API Key Secrets (Read)*; using a masked value is rejected as `Invalid API key` under every header arrangement. Worked around with the legacy `service_role` JWT in server-only `SUPABASE_SECRET_KEY`. **User action (optional):** grant the token *API Key Secrets (Read)*, then switch `SUPABASE_SECRET_KEY` to the `sb_secret_…` value.

**Signing-key mode.** `GET /auth/v1/.well-known/jwks.json` returns an **EC key** → asymmetric keys; `getClaims()` takes the local signature-verification path (10.1's expectation confirmed).

**Auth mechanics — `tests/live/01-auth-mechanics.mjs` 5/5 PASS.** Server `createUser` with `<internal-id>@students.invalid` plus the `provisioned_by` marker works; `signInWithPassword` works; the resulting JWT is accepted by PostgREST as `authenticated`; GoTrue rejects a public `.invalid` sign-up (invalid-email error); `deleteUser` cleanup works.

**Sign-up guard — `tests/live/05-signup-guard.mjs` 4/4 PASS, plus function checks.** Public sign-up refused: `422 Signups not allowed for this instance` (`disable_signup = true`). Self sign-up into `students.invalid` refused. Server-provisioned creation still works. Hook `before_user_created` logic verified by direct SQL invocation: allows only `app_metadata.provisioned_by = 'school-platform'`, otherwise returns a `403` with a uniform message (marked / unmarked / no-metadata events all asserted). GoTrue invocation of the hook verified by briefly re-enabling sign-up: a plain sign-up returned `403 Sign-up is not available. Ask your school administrator to create your account.` (the hook's message); sign-up was then re-disabled and the config re-read as disabled. The hook runs on the **sign-up path only**; the service-role admin API does not pass through it and is protected by the key never leaving the server.

**Portal flow — `tests/live/03-portal-flow.mjs` 22/22 PASS.** Issuance without a session → 401; a school-A admin issuing for a school-B learner → 403; invalid purpose → 400; unknown activation code → 400; mismatched passwords → 400; activation with a valid code → 200 with a uniform readiness message; single-use enforced (reuse → 400); expiry enforced (a backdated `issued_at`+`expires_at` code is rejected); school-code + username + password sign-in → 200 with a Supabase session cookie; wrong password / wrong school code / unknown username each → 401 with the same uniform message.

**Tenant isolation / RLS — `tests/live/04-rls-isolation.mjs` 15/15 PASS.** An admin sees exactly its own school's learners; requesting another school's rows returns nothing; cross-school insert is `42501` and cross-school update affects 0 rows; `has_school_permission` is true for the caller's school and false for another; audit events are readable and scoped to the caller's school; anon has no grant (`42501`); a student session (valid JWT, not a school member) lists no learners and has no school permission; **a member whose membership is `revoked` loses access immediately through an existing live session** (no school permission, no learner rows — the policy evaluates membership per query, so revoking does not wait for token expiry or re-login); the service key can read across schools (server-only bypass, by design).

**Session refresh (R-01) — `tests/live/06-refresh-session.mjs` 3/3 PASS.** The test shortens the project's `jwt_exp` to 60 s through the Management API, signs in through the portal, waits past the access-token expiry, then makes one request through the proxy and asserts the access token rotated (`exp` increased, rotated cookie) — an **observed** refresh, per the 7.2 wording. `jwt_exp` is restored in a `finally` block and re-read to prove restoration (3600). This confirms `proxy.ts` is invoked on Next.js 16 and that `getClaims()` in `src/lib/supabase/session.ts` refreshes against real GoTrue. Note: this API version names the field `jwt_exp`, not `jwt_expiry`.

**Concurrent refresh (R-02) — `tests/live/07-concurrent-refresh.mjs` 4/4 PASS.** Two simultaneous requests carrying the same expired session cookie: both served 200, both rotated the token (GoTrue's refresh reuse handling absorbs the race), and a follow-up navigation with the rotated cookie refreshed again. No spurious sign-out.

**Bundle secret scan — `tests/live/08-no-secrets-in-bundle.mjs` 1/1 PASS.** After `npm run build`, all 468 files under `.next/` were scanned for the literal `SUPABASE_SECRET_KEY` and `PORTAL_CREDENTIAL_SECRET` values; none appear (secret values are never printed; a leak would be reported as variable + file). This satisfies 7.1's "verify by inspecting the built output, not by assumption".

**Reproducibility.** `tests/live/02-seed.mjs` seeds two schools with admins and one learner each (FK-safe cleanup; passwords never printed or committed; transient state in a temp file). `tests/live/run-all.mjs` re-runs seed → flow → RLS → guard → session refresh → concurrent refresh against the running app (`npm run dev -- -p 3100`); the last two steps require `SUPABASE_MGMT_TOKEN` / `SUPABASE_MGMT_PROJECT_REF` (to shorten and restore `jwt_exp`) and are skipped with a warning when absent. The bundle scan is intentionally separate because it needs a production build (`npm run build && node tests/live/08-no-secrets-in-bundle.mjs`). One test bug was found and fixed during verification: the expiry check originally backdated only `expires_at`, which violated the `expires_at > issued_at` constraint and failed silently; it now backdates both columns and asserts the setup succeeds.

**Checks (2026-10-12).** `npm test` (85 unit tests), `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` all pass. `next.config.ts` sets `cacheComponents: true`; route handlers must not export `dynamic = "force-dynamic"` (compile error) and no longer do.

**Notes and limitations.**

- Network to `api.supabase.com` and `*.supabase.co` was intermittently flaky (DNS failures) on 2026-10-12; every live call was retried with backoff and transient failures recovered. Retrying is routine for this environment.
- The student password policy (min 8 / max 72 characters) remains **interim**; it is enforced in code and unit-tested.
- Phase 0 test-plan items that need a UI or features that do not exist yet are deferred to Phase 1, deliberately: sign-out and session-expiry behaviour in the interface (7.2), platform administration and cross-school file download (7.3), responsive/accessibility checks at mobile/tablet/desktop viewports (7.5), and connectivity/retry behaviour for a real workflow (7.6).
- Staff invitation email flows (D-018), the staff authentication model, and a non-development environment are outside this slice and remain open for Phase 1 completion (`docs/ROADMAP_AND_TESTING.md` Phase 1).
- RPO/RTO now have proposed production targets (D-022: RPO 24 h / RTO 24 h, not verified guarantees) and learner retention an interim framework (D-023); both were decided 2026-10-12. Live verification of backup capability, a non-production restoration test and the associated costs remains an open **production-readiness** task, unaffected by this slice.
- The `AGENTS.md` managed block written by `next dev` was removed and regeneration disabled (`agentRules: false`, Next 16.4).
