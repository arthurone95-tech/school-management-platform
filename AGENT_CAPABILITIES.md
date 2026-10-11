# AGENT_CAPABILITIES.md

**Project:** School Management Platform\
**Document status:** Agent capability description\
**Version:** 1.1

## 1. Purpose

This document describes the coding agent's working capabilities, their intended use, and their limitations within this multi-tenant school management platform.

It establishes what the agent may be capable of doing, not unrestricted authorization to perform every action.

The agent must follow:

- `AGENTS.md`
- `AGENT_WORKFLOW.md`
- `AUTOMATION_WORKFLOW.md`
- The relevant documentation in `docs/`

When instructions conflict, follow the applicable authorization requirements and request clarification before making a consequential decision.

## 2. Capability and Permission Are Different

The agent may possess tools capable of reading files, editing code, executing commands, accessing external services, or changing application infrastructure.

Possessing a tool does not automatically authorize its use.

Before performing an action, determine:

1. Is the required tool or capability available?
2. Is the action within the user's approved task?
3. Is the action permitted by repository and environment restrictions?
4. Is the target environment known?
5. Could the action affect sensitive data, security, external services, costs, or existing work?
6. Is explicit approval required?

If a required capability is unavailable, report the limitation instead of pretending the action was completed.

If a capability exists but the action is not authorized, obtain the necessary approval.

## 3. Codebase Inspection

The agent may inspect accessible project files to understand the implementation.

This includes:

- Application source code.
- Components and page structures.
- Existing API handlers and server-side logic.
- Database access patterns.
- Tests and validation scripts.
- Package manifests and dependency versions.
- Configuration files that can be safely inspected.
- Project documentation.
- Git status and change history where available.

The agent should trace relevant dependencies before changing a component that may affect other parts of the application.

Inspection must respect access restrictions. Secret values and sensitive data must not be exposed unnecessarily.

## 4. File Creation and Editing

The agent may create and edit files within the approved task.

Examples include:

- Application components.
- Server-side modules.
- Utility functions.
- Database migration files.
- Test files.
- Documentation.
- Safe configuration examples.
- Development scripts.

The agent must preserve unrelated user changes and avoid broad rewrites without justification.

It must not silently replace existing project architecture, remove important functionality, or expand the task beyond its approved scope.

Destructive file operations and difficult-to-reverse changes remain subject to the approval requirements in `AUTOMATION_WORKFLOW.md`.

## 5. Command Execution

When the appropriate tools are available and permitted, the agent may run commands to:

- Install or verify project dependencies.
- Start local development services.
- Run tests.
- Run linting and type checks.
- Build the application.
- Inspect repository status.
- Validate local configuration.
- Diagnose implementation failures.

The agent must inspect existing project scripts and configuration before selecting commands.

It must assess the effects of commands that modify files, databases, external services, or system configuration.

It must not blindly execute untrusted scripts, bypass security restrictions, or run destructive operations without the required approval.

## 6. Testing and Quality Assurance

The agent may create, run, and maintain tests appropriate to the project.

These may include:

- Unit tests.
- Integration tests.
- API tests.
- Authorization tests.
- Database policy tests.
- End-to-end tests.
- Regression tests.
- Responsive interface checks.
- Connectivity and offline synchronization tests.

Test coverage must reflect the risk and behavior of the feature.

For multi-tenant functionality, tests should verify both authorized access and attempted cross-school access. The authoritative test matrix is `docs/ROADMAP_AND_TESTING.md` 5; do not restate it.

For user-interface changes, tests should cover representative mobile, tablet, and desktop layouts where relevant.

For approved offline-capable workflows, tests should address persistence, synchronization, conflicts, retries, and recovery as applicable.

The agent must report actual test results. A test that was not run must not be reported as passed.

## 7. Database and Data Access

The agent may inspect database schemas, prepare migrations, review queries, and develop database tests when the required tools and permissions are available.

It may prepare changes to:

- Tables and relationships.
- Constraints and indexes.
- Row Level Security policies.
- Database functions and triggers.
- Migrations and seed data.
- Data-access utilities.

Database work must preserve data integrity and school isolation.

The agent must not assume that a migration is safe merely because it applies successfully.

Production database changes, destructive migrations, sensitive data modifications, and material changes to authorization require the appropriate approval.

The agent must not bypass RLS or expose privileged credentials to the client.

## 8. Authentication and Authorization

The agent may implement and test approved authentication and authorization requirements.

This may include:

- Session handling.
- User and school membership checks.
- Role and permission enforcement.
- Protected routes and API operations.
- Account and membership status checks.
- Administrative authorization.
- Access revocation behavior.

Authentication and authorization must be enforced at trusted boundaries, not only through frontend visibility rules.

The agent must not independently weaken access controls, grant broad privileges, or create cross-school administrative access without an approved design.

## 9. External Services and Integrations

When the necessary connectors, credentials, configuration, and permissions are available, the agent may work with approved services such as:

- Supabase.
- Application hosting providers.
- Email or messaging providers.
- Payment services.
- Monitoring and error-reporting services.
- Approved authentication or identity providers.
- Approved testing and automation services.

The agent must verify that a service is actually configured and accessible before claiming to have used it.

It must not invent successful API calls, fabricate service responses, expose credentials, or assume that a local change has modified an external service.

Creating paid resources, changing production configuration, sharing sensitive data externally, and performing consequential operations require the appropriate authorization.

## 10. Git and Repository Operations

The agent may inspect repository status, review diffs, identify changed files, and prepare code changes.

Where available and authorized, it may also use Git to create commits, push changes, merge branches, or prepare releases.

However, these operations are governed by the user's explicit authorization and the project's workflow.

Unless specifically authorized, the agent must not:

- Commit changes.
- Push branches or tags.
- Merge changes.
- Rewrite shared history.
- Discard unrelated modifications.
- Publish releases.

Permission to edit a file is not permission to publish the change.

## 11. Responsive Interface Capabilities

The agent may build and modify interfaces intended for:

- Mobile phones.
- Tablets.
- Laptops.
- Desktop computers.

It may implement responsive layouts, adaptive navigation, accessible forms, tables, dashboards, dialogs, and interactive controls.

It must follow `docs/UI_UX_DOCUMENTATION.md` and the acceptance criteria in `docs/FEATURE_SPECIFICATIONS.md`.

Responsive behavior must be verified at representative viewport sizes where the available tools permit.

The agent must report any device-specific or layout behavior it could not verify.

## 12. Low-Connectivity and Offline Capabilities

The agent may implement approved connectivity-resilience and offline features when the architecture, scope, and tools support them.

Potential capabilities include:

- Clear loading and connection-status feedback.
- Retry and recovery behavior.
- Protection against avoidable loss of user-entered information.
- Local persistence for explicitly approved workflows.
- Background or deferred synchronization where supported.
- Duplicate-request protection.
- Conflict detection and resolution.
- Recovery after interrupted synchronization.

These capabilities must not be assumed to exist simply because they are technically possible.

Offline operations must preserve authorization, school isolation, and data integrity.

The agent must not independently enable broad local caching or claim that the application works fully offline without implementation and verification.

## 13. Security Review

The agent may inspect code and configuration for potential security weaknesses, including:

- Broken access control.
- Cross-school data exposure.
- Unsafe database queries.
- Improper RLS policies.
- Exposed secrets.
- Unsafe file uploads.
- XSS and injection risks.
- Insecure session handling.
- Inadequate input validation.
- Sensitive information in logs or error messages.
- Weak offline-data protections.

A review identifies potential risks; it does not automatically prove that the system is secure.

The agent must describe findings accurately, distinguish confirmed vulnerabilities from concerns requiring further investigation, and avoid claiming comprehensive security assurance without sufficient evidence.

Consequential security changes remain subject to the approval workflow.

## 14. Documentation and Technical Reporting

The agent may create and maintain technical documentation, including:

- Product and feature specifications.
- Architecture descriptions.
- Database documentation.
- API contracts.
- Security and privacy guidance.
- User-interface requirements.
- Deployment procedures.
- Testing strategies.
- Decision records.

Documentation must reflect confirmed decisions and verified implementation.

The agent must distinguish existing behavior from planned functionality, proposals, and unverified assumptions.

It must not report that a document, configuration, service, or deployment was changed unless the action actually succeeded.

## 15. Limitations and Unavailable Capabilities

The agent must acknowledge limitations honestly.

For example:

- It cannot verify a remote service without suitable access or evidence.
- It cannot claim production behavior has been tested when only local tests were run.
- It cannot verify real-device behavior solely from a desktop build.
- It cannot guarantee security from a limited code review.
- It cannot guarantee full offline behavior without implementing and testing the required workflows.
- It cannot confirm a migration's production safety without sufficient knowledge of the target database and its data.
- It cannot claim legal or regulatory compliance solely from code inspection.
- It cannot complete an external operation when the required service, credential, permission, or tool is unavailable.

When a limitation blocks the task, explain what is missing and the practical next step.

## 16. Reporting Requirements

After completing a task, provide the completion report defined in `AGENT_WORKFLOW.md` 14.

That section is the single canonical definition. Do not restate or vary its headings here; update it instead if the format must change.

Two principles apply regardless of format:

- Separate what was verified from what was assumed, planned, or not run.
- If no action is required from the user, write: **User Task: None**

## 17. Final Principle

Use available capabilities to complete approved work efficiently and accurately.

Never confuse technical ability with authorization. Preserve school isolation, protect student and staff information, respect existing project decisions, and report the actual state of the work honestly.