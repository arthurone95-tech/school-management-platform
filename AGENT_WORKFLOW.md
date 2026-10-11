# AGENT_WORKFLOW.md

**Project:** School Management Platform\
**Document status:** Canonical agent workflow\
**Version:** 1.1

## 1. Purpose

This document defines the standard workflow the coding agent must follow when working on this school management platform.

The objective is to deliver correct, secure, maintainable, and verifiable changes without unnecessary complexity, uncontrolled implementation, or avoidable interruptions.

Follow this workflow together with `AGENTS.md` and the project's documentation in `docs/`.

## 2. Receive and Understand the Task

When a task is received:

1. Identify the intended outcome.
2. Identify the exact feature, bug, documentation, or system area involved.
3. Determine what is included in the task and what is outside its scope.
4. Review relevant project documentation and existing implementation.
5. Identify dependencies, assumptions, risks, and unresolved decisions.

Do not assume that a short request authorizes unrelated improvements.

If the task is sufficiently clear and low-risk, proceed without unnecessary questions.

If a missing detail could materially change the implementation, security, data integrity, cost, or user experience, ask for clarification before making that decision.

## 3. Inspect Before Changing

Before editing code or configuration:

- Inspect the relevant files and their relationships.
- Identify existing conventions, reusable components, and established patterns.
- Review applicable tests and validation mechanisms.
- Check the current Git working tree before changes that could affect existing work.
- Confirm whether the required functionality already exists.
- Identify whether the task affects the database, APIs, authentication, authorization, storage, school isolation, or deployment.

Do not overwrite existing work simply because a different implementation seems easier.

Do not report that a file, service, database, or configuration was inspected unless it was actually inspected.

## 4. Plan the Work

For complex, cross-cutting, or consequential tasks, prepare a short plan containing:

- **Objective:** What will be achieved.
- **Scope:** What will change and what will remain untouched.
- **Files and components:** The expected areas of modification.
- **Dependencies:** Required services, migrations, packages, credentials, or decisions.
- **Security considerations:** Relevant authorization, privacy, and data-isolation requirements.
- **Verification:** How correctness will be tested.
- **User involvement:** Any approval, information, or manual testing required.

For small, straightforward tasks, use a lightweight plan rather than producing unnecessary paperwork.

If the plan reveals a consequential unresolved decision, obtain approval before implementing that decision.

## 5. Implement Within Scope

During implementation:

- Make only the changes required for the approved task.
- Preserve existing working functionality unless the task explicitly requires changing it.
- Follow the established architecture and coding conventions.
- Reuse appropriate components and utilities.
- Keep changes understandable, maintainable, and appropriately modular.
- Add or update tests when needed.
- Update relevant documentation when established behavior or technical contracts change.
- Avoid unrelated refactoring, dependency upgrades, or feature additions.

If an unexpected issue requires a materially broader change, stop and explain the issue before expanding the task.

Do not leave placeholder implementations, fake success responses, or unimplemented security checks disguised as completed functionality.

## 6. Security and Multi-School Verification

For any change involving school data, users, roles, records, APIs, storage, reports, or administrative functions, evaluate school-level authorization explicitly.

Verify, as applicable:

1. An authorized user can perform the intended operation within the correct school.
2. A user without the required permission is denied.
3. A user from another school cannot access or modify the resource.
4. Direct API requests cannot bypass the intended authorization.
5. Database RLS and server-side checks enforce the expected restrictions.
6. School switching, session expiration, and membership revocation do not leave unauthorized access available.

The full test matrix is in `docs/ROADMAP_AND_TESTING.md` 5. Use the project's documented authorization model. Do not invent or weaken access rules to make a test pass.

If the available environment cannot verify an important security property, report that limitation instead of assuming the property is satisfied.

## 7. Responsive Design Verification

For changes affecting the user interface, verify the affected workflow at representative:

- Mobile phone viewport sizes.
- Tablet viewport sizes.
- Desktop and laptop viewport sizes.

Check navigation, forms, dialogs, tables, dashboards, interactive controls, text readability, and overflow where relevant.

Do not consider a user-interface task complete solely because it works on the development machine's default viewport.

Use automated browser tests, screenshots, or manual inspection when the project's available tools support them. State which methods were actually used.

## 8. Connectivity and Offline Verification

For features affected by unreliable connectivity:

- Check loading, timeout, failure, retry, and recovery behavior where relevant.
- Verify that interrupted operations do not create avoidable data loss or inconsistent records.
- Consider duplicate requests and safe retries.
- For approved offline-capable workflows, test local persistence, synchronization, conflict handling, and recovery as applicable.
- Verify that local data and synchronization cannot bypass current authorization or expose another school's records.

The authoritative offline requirements, including logout, school switching, revoked access, and shared-device risks, are in `docs/FEATURE_SPECIFICATIONS.md` 8 and `docs/SECURITY_AND_PRIVACY.md` 12.

Do not implement offline functionality merely because it may be useful. Follow the approved feature specification.

Do not describe a workflow as offline-capable unless the necessary implementation and tests support that claim.

## 9. Testing and Validation

After implementation, run the relevant checks supported by the repository.

These may include:

- Targeted automated tests.
- Regression tests.
- Unit and integration tests.
- Type checking.
- Linting.
- Production builds.
- Database migration validation.
- API and authorization tests.
- Responsive interface checks.
- Connectivity and synchronization tests.

Use the project's actual scripts and supported commands. Inspect `package.json`, configuration, or existing documentation instead of guessing command names.

When a check fails:

1. Determine whether the failure was introduced by the change or existed beforehand.
2. Investigate the cause.
3. Fix issues within the approved scope when safe.
4. Rerun the relevant checks.
5. Report unresolved failures and their impact.

Never suppress a meaningful failure, weaken a security check, or modify a test simply to obtain a passing result without addressing the underlying requirement.

If a check cannot run because a service, credential, environment, or dependency is unavailable, report it as not run.

## 10. Handle Blockers and Unexpected Findings

If work cannot proceed safely:

- Explain the specific blocker.
- Identify what has already been completed.
- Explain the available options and their trade-offs.
- State what decision, access, or information is needed.
- Avoid making consequential assumptions merely to keep moving.

For example, if an operation requires production credentials that have not been provided, do not invent credentials or silently substitute a production environment with a different environment.

When an unexpected defect is discovered outside the task's scope, report it and propose a separate action unless immediate containment is necessary to prevent harm.

## 11. Documentation and Configuration

When a change affects the documented behavior of the application:

- Update the relevant feature specification, API documentation, database documentation, security documentation, or operational instructions.
- Record important architectural decisions in `docs/DECISIONS.md`.
- Distinguish confirmed behavior from proposed or unverified behavior.
- Ensure examples and configuration instructions do not expose secrets.
- Do not claim a configuration has been applied unless it was actually applied and verified.

For documentation-only tasks, change documentation only unless the user explicitly authorizes additional work.

## 12. Git, External Services, and Deployment

Follow the authorization requirements in `AGENTS.md`.

Before changes that may affect existing work, inspect the Git status and preserve unrelated modifications.

Do not automatically commit, push, merge, publish, deploy, run production migrations, or perform destructive external operations.

When explicit approval is required, ask before proceeding and explain the intended action and its material risks.

A successful local build does not prove that deployment succeeded. A successful deployment does not prove that production behavior is correct.

Report each verification separately.

## 13. Completion Criteria

A task may be reported as complete only when:

- The approved scope has been implemented or the requested documentation has been updated.
- Relevant existing functionality has been preserved.
- Applicable tests and checks have been run, or their limitations have been disclosed.
- Important security and school-isolation implications have been considered.
- Relevant documentation has been updated where necessary.
- Remaining limitations and user actions have been identified.

If only part of the task is complete, report it as partially complete.

Do not describe an untested feature as verified or a proposed implementation as operational.

## 14. Required Final Report

**This section is the canonical completion report for the project.** Other instruction files reference it rather than restating it.

Every completed or blocked task must end with the following report.

### Plain Summary
Explain what was done in straightforward language.

### Changes Made
List the files and the changes made to them.

### Verification
List the checks performed and their actual outcomes. Explicitly identify checks that were not run.

### Risks or Limitations
Report known issues, unresolved questions, and important limitations.

### User Task
Give exact steps for anything the user must do, including approvals, credentials, manual testing, or decisions.

If no user action is required, state:

**User Task: None**

Keep the report concise but sufficiently detailed for the user to understand the actual state of the project.

## 15. Operating Principle

Inspect before changing. Plan when needed. Implement only the approved scope. Verify what can be verified. Report what remains uncertain. Protect school data throughout the process.