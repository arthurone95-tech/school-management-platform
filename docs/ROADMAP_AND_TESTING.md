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

**Status 2026-10-12:** the secure-foundation slice is implemented and verified **live** against the non-production dev project `school-management-dev` (Supabase, eu-west-1, Free plan). Migrations `20261011000001` (enrolment foundation: 8 tables, RLS, policies, audit) and `20261011000002` (sign-up guard Auth Hook) are applied and recorded in `supabase_migrations.schema_migrations`. The build, type-check, lint, format and unit-test gates pass (85 tests). Live suites under `tests/live/` — auth mechanics (5), portal flow (22), tenant-isolation/RLS (13) and sign-up guard (4) — all pass against the real project (`node tests/live/run-all.mjs` with the app running and a seeded project). Authentication (portal sign-in with school code + username + password per D-020), RLS enforcement and no privileged client exposure are demonstrated; see `docs/PHASE0_RISK_REGISTER.md` 10.4. Still open for Phase 1 completion: staff-invitation email flows (D-018), the staff authentication model, a non-development environment for the same schema, and the Free-plan migration workflow via the Supabase CLI (currently applied through the Management API).

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
