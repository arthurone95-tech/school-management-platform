# AUTOMATION_WORKFLOW.md

**Project:** School Management Platform\
**Document status:** Canonical approval boundaries\
**Version:** 1.1

## 1. Purpose

This document defines the boundaries for autonomous work by the coding agent on this multi-tenant school management platform.

The agent should complete clearly defined, low-risk tasks independently while protecting school data, preserving approved architecture, and requesting approval before consequential actions.

Follow this document together with `AGENTS.md`, `AGENT_WORKFLOW.md`, and the project documentation in `docs/`.

## 2. General Autonomy Rule

The agent may proceed independently when an action is:

- Clearly within the user's requested scope.
- Consistent with approved project requirements and architectural decisions.
- Reasonably reversible.
- Low-risk and unlikely to affect production data, security boundaries, external commitments, or unrelated work.
- Verifiable using the available tools and environment.

The agent must pause for clarification or approval when an action is ambiguous, consequential, difficult to reverse, or outside the approved scope.

Do not ask for permission for every ordinary file edit, routine test, or safe local investigation. Avoid unnecessary interruptions when the task is already clear.

Permission to perform one task does not automatically authorize unrelated work discovered during that task.

## 3. Actions the Agent May Perform Independently

When relevant to the approved task, the agent may:

- Read and inspect project source files and documentation permitted by the repository's access controls.
- Search the codebase for existing implementations, dependencies, and related tests.
- Explain findings and prepare implementation plans.
- Edit ordinary source files within the approved scope.
- Create or update tests and documentation.
- Make routine, reversible code improvements required to complete the task.
- Run appropriate local tests, linting, type checks, and builds.
- Investigate failures and correct defects within the approved scope.
- Update safe example configuration files without adding real secrets.
- Check responsive layouts and ordinary failure states using available tools.
- Inspect Git status and review diffs.
- Report blockers, risks, test results, and recommended next steps.

These permissions do not override repository permissions, tool restrictions, security controls, or any requirement for explicit approval.

## 4. Actions Requiring Explicit Approval

**This section is the authoritative list of approval boundaries for the project.** Other instruction files summarise or reference it rather than restating the rules, so that there is one place to change them.

Unless the user has explicitly authorized the specific action and its relevant scope, the agent must request approval before:

### A. Destructive or Difficult-to-Reverse Actions

- Permanently deleting files, records, storage objects, or other important resources.
- Overwriting or discarding existing user work.
- Running destructive shell commands or broad cleanup operations.
- Removing major application functionality.
- Performing data transformations that cannot be safely reversed.
- Resetting environments or databases that contain valuable data.

The agent must explain the affected resources and recovery implications before requesting approval.

### B. Database and Migration Changes

- Applying migrations to production.
- Dropping or renaming important tables or columns.
- Removing constraints, indexes, policies, or relationships with material data or security implications.
- Performing destructive schema changes.
- Running bulk updates or deletions against important datasets.
- Modifying production data directly.
- Changing database behavior in ways that may affect existing schools or records.

Ordinary development migrations may be prepared and validated locally when within scope. Applying a migration to a consequential environment requires the appropriate authorization.

### C. Security and Authorization Changes

- Weakening or removing Row Level Security policies.
- Bypassing server-side authorization.
- Changing authentication or session-security behavior materially.
- Granting broader permissions to users, roles, services, or storage resources.
- Exposing private resources publicly.
- Changing privileged credential handling.
- Disabling meaningful security tests or safeguards.
- Introducing cross-school access or broad administrative privileges.

Security changes must not be treated as routine refactoring.

### D. External Services and Financial Commitments

- Enabling a paid service or creating a financial commitment.
- Changing billing plans or resource tiers.
- Creating production resources that may incur charges.
- Sending bulk communications to real users.
- Making consequential changes to payment, email, messaging, or other external integrations.
- Sharing school or student data with an external service that has not been approved for that purpose.

Safe, read-only investigation of a service may proceed when authorized by the task and permitted by the available tools.

### E. Git and Release Operations

Unless specifically authorized:

- Do not commit changes.
- Do not push branches or tags.
- Do not merge pull requests.
- Do not create releases.
- Do not deploy to production.
- Do not change production environment variables.
- Do not run production migrations as part of an ordinary deployment.
- Do not reset, force-push, or rewrite shared Git history.

Inspecting Git status and reviewing local diffs are permitted.

Explicit approval for one release or deployment does not automatically authorize future releases or unrelated destructive actions.

## 5. Environment Boundaries

Distinguish clearly between development, testing, staging, and production.

Before running a command that could change external state, determine the target environment and likely effects.

- Prefer development and dedicated testing environments for experiments.
- Never assume a configured database or service is disposable.
- Do not assume that a project named "test" contains no valuable data.
- Do not use production credentials for routine local testing when an approved test environment is available.
- Do not switch environments silently to make a task succeed.
- Do not run destructive operations when the target environment is uncertain.

If the target cannot be established reliably, stop and request clarification.

## 6. Secrets and Credentials

Treat credentials and secret values as sensitive.

- Never invent, expose, commit, or hardcode credentials.
- Do not read secret files unnecessarily.
- Do not print secret values in terminal output, logs, reports, screenshots, or generated documentation.
- Use approved environment variables and secret-management mechanisms.
- Use placeholder values in examples.
- Do not transfer credentials to external services unless explicitly authorized and necessary for the approved task.
- Do not bypass configured file-access restrictions to obtain a secret.
- If a credential is exposed, report the incident and recommend appropriate rotation or revocation.

If a task cannot proceed without a credential, explain exactly which credential or configuration is missing without requesting that the user publish it in source code.

## 7. Dependencies and Commands

The agent may inspect installed packages and run routine project commands that are safe for the current environment.

Before adding or upgrading a dependency:

- Determine whether an existing dependency already provides the required functionality.
- Check compatibility with the current stack.
- Consider maintenance, security, licensing, and cost implications where relevant.
- Avoid unrelated upgrades.

Ask for approval before installing software or running commands that have material security, financial, destructive, or system-wide consequences.

Do not run untrusted scripts or blindly execute commands copied from external sources.

## 8. School Data and Multi-Tenant Boundaries

Every autonomous change must preserve school-level data isolation.

The agent must not:

- Grant one school's users access to another school's records without an explicitly approved authorization model.
- Rely solely on client-side filtering for data isolation.
- Bypass RLS to avoid debugging an authorization problem.
- Expose private student, guardian, staff, or school records in public storage or logs.
- Export real school data into an unapproved environment.
- Copy production records into development or testing without an approved and appropriately protected process.
- Expand access to privileged service credentials for convenience.

When testing authorization, prefer synthetic data and controlled test accounts.

If a proposed solution requires a new cross-school administrative capability, document the requirement, scope, safeguards, and audit needs before implementation.

## 9. Offline and Local Data Boundaries

Offline functionality must follow the approved feature specifications.

The agent may implement an already approved offline workflow within its documented scope.

It must not independently decide to cache all school records or make the entire application offline-capable.

The requirements to account for before introducing local persistence or synchronization — including synchronisation and conflict behaviour, duplicate submissions and safe retries, failed synchronisation and recovery, logout, school switching, membership revocation, session expiration, and shared- or lost-device risks — are specified in `docs/FEATURE_SPECIFICATIONS.md` 8 and `docs/SECURITY_AND_PRIVACY.md` 12. Do not restate them here.

If those requirements are unresolved and materially affect security or data integrity, request a decision before implementing the affected behavior.

## 10. Responsive Design Boundaries

The agent may make responsive interface changes that are within the approved task.

It must preserve usability across mobile phones, tablets, laptops, and desktops.

Do not independently remove important content, controls, or workflows from smaller screens merely to simplify a layout.

For relevant changes, inspect the affected interface at representative viewport sizes and report any unverified devices, layouts, or interactions.

## 11. Handling Ambiguity

When a task is ambiguous, assess whether the uncertainty is material.

Proceed without asking when a reasonable implementation is clearly supported by existing documentation and has low risk.

Ask for clarification when different interpretations could materially affect:

- User-visible behavior.
- School data access.
- Student or staff privacy.
- Data integrity or recovery.
- Authentication or authorization.
- Recurring or external costs.
- Approved architecture.
- Production operations.

When asking, explain the issue, recommend an option where appropriate, and identify the specific decision needed.

Do not ask broad questions when one precise question is sufficient.

## 12. Handling Unexpected Problems

If an unexpected issue appears during an approved task:

1. Determine whether it is within scope.
2. Assess whether it presents an immediate security, data-loss, or operational risk.
3. Contain immediate risk using only actions already authorized and reasonably safe.
4. Do not perform broader destructive remediation without approval.
5. Explain the issue, its potential impact, and the available options.
6. Resume the original task only when it remains safe to do so.

Do not silently expand the task into a major refactor or architectural redesign.

## 13. Failed Tests and Incomplete Work

When tests or commands fail:

- Investigate failures relevant to the task.
- Fix defects within scope when safe.
- Do not suppress meaningful errors merely to produce a successful build.
- Do not weaken security checks or acceptance criteria to make tests pass.
- Report failures that remain unresolved.
- Distinguish verified behavior from assumptions.
- Identify tests that could not run because of missing credentials, services, devices, or infrastructure.

If the implementation is incomplete, report it as incomplete rather than claiming success.

## 14. Approval Requests

When approval is required, provide a concise request containing:

**Action:** The exact operation being proposed.

**Reason:** Why it is needed.

**Impact:** The resources, users, environments, or data it may affect.

**Risk:** The principal failure or recovery concern.

**Alternatives:** Safer options, if available.

**Approval needed:** The specific decision or authorization required.

Do not perform the consequential action until the required approval has been received.

## 15. Completion Report

After each task, provide the completion report defined in `AGENT_WORKFLOW.md` 14.

That section is the single canonical definition. Do not restate or vary its headings here.

Do not claim that a change was saved, a test passed, a service was configured, or a deployment succeeded unless the available evidence supports that claim.

## 16. Final Principle

Act independently on clearly authorized, low-risk work. Pause before consequential or ambiguous actions. Never sacrifice school data isolation, privacy, security, or recoverability for convenience or speed.