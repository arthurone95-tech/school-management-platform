# AGENTS.md

**Project:** School Management Platform\
**Document status:** Canonical agent instructions\
**Version:** 1.1

## 1. Project Purpose

This repository contains a multi-tenant school management platform designed initially for community schools in Ghana.

The application must support multiple schools through one shared codebase and, initially, one shared application deployment and one shared Supabase production project.

Supabase is the confirmed backend direction (see `docs/DECISIONS.md` D-012 and D-015). Development begins on the Supabase Free plan, which is not a production configuration.

Each school operates within an isolated logical workspace with its own authorized users, students, classes, records, settings, and enabled modules.

The long-term architecture must preserve the option to move individual schools to dedicated infrastructure when justified by security, operational, contractual, or scalability requirements.

The project must prioritize correctness, security, maintainability, usability, and reliable operation over implementation speed.

## 2. Source of Truth

Before making changes, inspect the relevant project files and documentation.

Use these documents as the primary project references:

- `docs/PRD.md`: Product requirements and scope.
- `docs/FEATURE_SPECIFICATIONS.md`: Feature behavior and acceptance criteria.
- `docs/SYSTEM_ARCHITECTURE.md`: Application architecture and technical boundaries.
- `docs/DATABASE_DOCUMENTATION.md`: Database structure, relationships, and data constraints.
- `docs/API_DOCUMENTATION.md`: API contracts and authorization expectations.
- `docs/SECURITY_AND_PRIVACY.md`: Security, privacy, access control, and data protection requirements.
- `docs/UI_UX_DOCUMENTATION.md`: Interface, accessibility, and responsive design requirements.
- `docs/DEPLOYMENT_AND_OPERATIONS.md`: Environments, deployment, backups, and operational procedures.
- `docs/ROADMAP_AND_TESTING.md`: Implementation sequence and testing requirements.
- `docs/PHASE0_RISK_REGISTER.md`: Phase 0 stack validation, risk register, and initial test plan.
- `docs/DECISIONS.md`: Confirmed architectural decisions, unresolved questions, and decision history.

Not every document may be present at every stage. Inspect the available files and do not assume that a missing document has been completed.

Two documents hold canonical rules that other files reference rather than restate: the completion report format in `AGENT_WORKFLOW.md` 14, and the approval boundaries in `AUTOMATION_WORKFLOW.md` 4.

When instructions appear inconsistent, identify the conflict before making a consequential decision. Do not silently replace an approved architectural decision with a personal preference.

Do not invent requirements, credentials, integrations, completed features, or approved decisions.

## 3. Required Working Approach

For every task:

1. Understand the requested outcome and its scope.
2. Inspect the relevant code, documentation, configuration, and existing tests.
3. Identify dependencies, risks, affected components, and applicable project requirements.
4. Prepare a concise implementation plan for work that is complex, cross-cutting, or consequential.
5. Implement only the approved scope.
6. Run appropriate tests, checks, and builds where available.
7. Review the changes for correctness, security, regressions, and consistency with the documentation.
8. Update relevant documentation and tests when the implementation changes established behavior.
9. Report what changed, what was verified, what remains incomplete, and whether any user action is required.

Do not rush into implementation before understanding the existing codebase.

Do not rewrite working components or replace established architecture merely because another approach is available.

Prefer small, coherent, reviewable changes over unnecessary large-scale rewrites.

For straightforward, low-risk tasks, proceed without unnecessary planning overhead.

## 4. Multi-Tenant Architecture and School Isolation

Treat school-level data isolation as a fundamental security requirement.

- Every school-specific resource must have a clearly defined school ownership or authorization boundary.
- A user authorized for one school must not automatically gain access to another school.
- Never rely solely on frontend filtering, hidden interface elements, client-side role checks, or user-supplied school identifiers to enforce isolation.
- Enforce authorization on the server and through appropriate database policies.
- Use PostgreSQL Row Level Security (RLS) for protected school data where applicable.
- Validate school membership, role, and required permissions for each protected operation.
- Prevent cross-school access through direct database queries, APIs, storage objects, background jobs, exports, search, reports, and administrative operations.
- Do not trust school IDs, user IDs, role names, or permission claims supplied by an untrusted client without verification.
- Privileged service credentials must remain server-side and must never be exposed to browser code.
- Cross-school administrative access must be explicit, narrowly scoped, authorized, and auditable.
- School switching must update the active context safely and must not expose data from the previously selected school. Membership in more than one school is excluded from the first release (D-017), but keep the model able to support it later without redesign.

Test both authorized access and attempted cross-school access.

Never weaken school isolation to make a feature easier to implement.

## 5. Authentication and Authorization

Authentication establishes identity. Authorization determines what that identity may do.

- Use the project's approved authentication architecture.
- Enforce permissions at the server or another trusted enforcement boundary.
- Apply the principle of least privilege.
- Verify role and school membership before protected reads, writes, exports, and administrative actions.
- Do not treat possession of a valid session as permission to access every resource.
- Do not trust frontend-only access restrictions.
- Handle expired sessions, revoked memberships, disabled accounts, and unauthorized requests safely.
- Avoid leaking sensitive information through errors or logs.
- Preserve existing authorization guarantees when changing application flows.

If a task requires a new role, permission, privileged operation, or authorization model, identify the change and obtain approval before implementing the consequential security decision.

## 6. Database and Data Integrity

Database changes must preserve data integrity, school isolation, and compatibility with existing records.

- Inspect the current schema, relationships, constraints, indexes, RLS policies, and migrations before changing them.
- Use migrations for schema changes when supported by the project's established workflow.
- Avoid destructive schema changes without explicit approval and a recovery plan.
- Use appropriate foreign keys, uniqueness constraints, validation, and transactions.
- Consider concurrent requests, duplicate submissions, partial failures, and retry behavior.
- Use pagination for potentially large result sets.
- Avoid unrestricted queries that retrieve all school records unnecessarily.
- Do not bypass RLS as a convenience.
- Do not run unreviewed production migrations or destructive database operations.
- Document important schema and authorization changes.

Do not assume that a change is safe merely because it works with a small development dataset.

## 7. Security and Privacy

Apply secure development practices throughout the project.

- Validate and normalize untrusted input at appropriate boundaries.
- Prevent SQL injection, cross-site scripting (XSS), broken access control, request forgery where applicable, insecure direct object references, and unsafe file handling.
- Use secure session and authentication practices.
- Protect personal information, especially student and child records.
- Collect and expose only the data necessary for an authorized purpose.
- Avoid putting sensitive information in URLs, client-visible errors, analytics events, or application logs.
- Apply suitable authorization and validation to uploads, downloads, exports, and generated reports.
- Use appropriate rate limits and abuse protections for sensitive or exposed operations.
- Consider account revocation, school membership changes, retention, deletion, backups, and recovery.
- Review relevant Ghanaian legal and regulatory requirements with qualified advice where necessary. Do not present unverified legal interpretations as established compliance.

Never claim the application is secure, compliant, or production-ready solely because a test passes.

## 8. Secrets and Environment Variables

Secrets and credentials must never be exposed, committed, or copied into application code.

- Do not read, print, expose, or modify secret values unnecessarily.
- Never commit real `.env` files, access tokens, private keys, service-role keys, passwords, or production credentials.
- Keep `.env` and environment-specific secret files protected.
- `.env.example` may contain documented variable names and safe placeholder values only.
- Browser-accessible environment variables must never contain server-only secrets.
- Do not send credentials to external services or paste them into reports.
- If a secret is accidentally exposed, stop the unsafe activity, report the exposure, and recommend appropriate revocation or rotation.

Follow the repository's configured permissions and environment-handling rules. Do not bypass them to complete a task.

## 9. Responsive Design and Accessibility

The application must provide a usable experience across mobile phones, tablets, laptops, and desktop computers.

- Treat responsive design as a mandatory requirement, not an optional enhancement.
- Adapt layouts, navigation, forms, tables, dashboards, dialogs, and interactive controls to different screen sizes.
- Support practical touchscreen interaction and desktop input methods.
- Prevent unintended horizontal scrolling in ordinary workflows.
- Maintain readable text, clear hierarchy, visible interaction states, and accessible labels.
- Provide appropriate loading, empty, error, and success states.
- WCAG 2.2 Level AA is the accessibility target (D-016). Apply it as the general rule, and record and justify any exception rather than lowering the target.
- Test representative mobile, tablet, and desktop viewports for affected interfaces.

Do not claim responsive support based solely on the application rendering at one screen size.

The authoritative requirements and acceptance criteria are in `docs/PRD.md` 9.1 and 9.3, `docs/FEATURE_SPECIFICATIONS.md` 13.1, and `docs/UI_UX_DOCUMENTATION.md` 11. Do not restate them here.

## 10. Connectivity and Offline Behavior

Design for schools that may experience slow, unstable, or interrupted internet connections.

- Handle loading delays, failed requests, retries, and interrupted operations clearly.
- Protect user-entered information from avoidable loss where technically feasible.
- Do not claim that the entire application works offline by default.
- Treat offline functionality as a feature-specific capability requiring explicit scope and approval.
- Protect locally stored school and student data.
- Do not cache all school records on a device without a justified and approved requirement.
- Verify offline behavior with tests before describing a workflow as offline-capable.

Never weaken authorization or privacy controls to make offline operation easier.

The authoritative offline requirements and acceptance criteria are in `docs/PRD.md` 9.2 and `docs/FEATURE_SPECIFICATIONS.md` 8 and 13.2. Do not restate them here.

## 11. Frontend and Backend Boundaries

Maintain clear boundaries between user-interface code, trusted server logic, and data access.

- Keep privileged operations on the server.
- Do not place secret keys or service credentials in client-side bundles.
- Validate data on trusted boundaries even when frontend validation exists.
- Keep business rules consistent across all entry points to the same operation.
- Reuse established project patterns where they remain appropriate.
- Avoid unnecessary duplication, tightly coupled components, and oversized modules.
- Keep error handling explicit and avoid silently swallowing failures.
- Do not introduce new dependencies without a clear reason.

Use the framework's supported patterns and the versions established by the project. Verify compatibility before making significant stack changes.

## 12. Files, Uploads, and Generated Content

File handling must be secure and appropriately authorized.

- Validate file type, size, and relevant content constraints.
- Do not rely exclusively on a filename or client-provided MIME type.
- Verify that the requesting user may upload, view, download, replace, or delete the target file.
- Enforce school-level access boundaries for stored files.
- Avoid public exposure of private student, staff, or school documents.
- Use approved storage policies and secure access mechanisms.
- Handle failed uploads and interrupted transfers safely.
- Avoid permanent deletion or overwriting without approval when the action is consequential.

## 13. Testing and Verification

Test changes according to their risk and scope.

Where relevant, verify:

- Expected successful behavior.
- Validation and error handling.
- Authentication and authorization.
- Cross-school isolation.
- Database constraints and RLS behavior.
- Mobile, tablet, and desktop layouts.
- Slow, interrupted, and failed network requests.
- Offline and synchronization behavior for approved offline-capable workflows.
- Regression risks in related features.
- Build, lint, type-check, and automated test results where supported.

Never fabricate test results or report a command as successful if it was not run or its outcome is unknown.

Distinguish clearly between tests passed, tests failed, tests not run, and behavior not yet verified.

If a required test cannot be run, explain the limitation and the remaining risk.

## 14. Dependencies and Tool Use

- Inspect the existing dependency versions and package manager before installing or upgrading packages.
- Prefer existing dependencies when they adequately meet the requirement.
- Check compatibility and maintenance implications before introducing a dependency.
- Do not upgrade unrelated packages as part of a narrowly scoped task.
- Avoid destructive shell commands and broad file operations.
- Explain consequential command effects before requesting approval.
- Never work around security controls, repository permissions, or environment restrictions to force a successful result.

## 15. Git and Deployment

Git and deployment actions must follow the user's authorization.

- Inspect the current branch and working-tree changes before making changes that could affect existing work.
- Do not overwrite, discard, reset, or remove unrelated user changes.
- Do not commit, push, merge, release, or deploy unless explicitly authorized under the project's workflow.
- Do not run destructive production operations without explicit approval.
- Do not treat permission to edit files as permission to publish them.
- Preserve an understandable change history.
- Report any uncommitted changes and relevant Git status.

Before a consequential deployment, verify the target environment, configuration, migration requirements, rollback or recovery options, and available test evidence.

## 16. Actions Requiring Approval

Stop and request explicit approval before performing a consequential action that has not already been authorized.

**The authoritative approval boundaries are in `AUTOMATION_WORKFLOW.md` 4.** That section is the single place where the rules are maintained. This section states the governing principle only:

Routine, reversible changes that are clearly within the approved task may proceed without unnecessary interruption.

When uncertain whether an action is consequential, explain the risk and ask before proceeding.

## 17. Documentation and Decision Management

Keep project documentation consistent with the actual implementation.

- Update relevant documentation when a feature, API, schema, security control, or operational procedure changes.
- Record important architectural decisions in `docs/DECISIONS.md`.
- Separate confirmed decisions from proposals and unresolved questions.
- Do not silently invent answers to unresolved requirements.
- Avoid duplicating requirements across documents when a clear reference is sufficient.
- Do not claim documentation has been updated unless the changes were actually saved.

If a task exposes a meaningful ambiguity, report it and identify the decision required.

## 18. Completion Report

After completing a task, provide a concise report using the five headings defined in `AGENT_WORKFLOW.md` 14.

That section is the canonical definition of the report format. Use it rather than restating or varying the headings here.

It must separate verified results from assumptions, and must state the exact action required from the user. If no action is required, write:

**User Task: None**

Do not claim that a feature is complete, secure, deployed, or verified unless the available evidence supports that claim.

## 19. Final Operating Principle

Protect school data, preserve school isolation, respect approved decisions, and verify changes before declaring them complete.

When a requirement is ambiguous, investigate first. When a consequential decision is unresolved, ask. When a limitation remains, report it honestly.