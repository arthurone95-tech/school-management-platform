# System Architecture

**Project:** School Management Platform\
**Document status:** Recommended architecture baseline\
**Version:** 1.1

## 1. Architectural Objective

Establish a maintainable and secure foundation for a multi-tenant school management platform serving schools in Ghana.

The architecture must support shared infrastructure without compromising school-level data isolation. It must also accommodate low-connectivity environments, evolving school requirements and future growth.

## 2. Established Direction

The initial product direction is:

- One primary codebase and GitHub repository.
- One shared application deployment initially.
- One shared production Supabase project initially.
- Separate logical workspaces for individual schools.
- Independently configurable school settings and module availability.
- Server-side authorization and PostgreSQL Row Level Security (RLS).
- A web-first application with PWA capabilities where supported.
- Explicitly scoped offline functionality with controlled synchronization.
- A documented path to dedicated infrastructure for individual schools if future needs justify it.

These decisions should not be changed casually. Any major deviation must be justified by evidence and recorded in the architecture decision log.

## 3. Proposed Technology Stack

Items differ in status. Check `docs/DECISIONS.md` before treating anything here as settled.

**Confirmed (D-011, D-012, D-015):**

- **Application framework:** Next.js with TypeScript.
- **Database:** Supabase PostgreSQL.
- **Authentication:** Supabase Auth, subject to validation of the required authentication and account-management flows.
- **File storage:** Supabase Storage with private access policies where appropriate.

**Still proposed, not yet confirmed:**

- **User interface:** Responsive web UI with accessible reusable components.
- **Offline support:** PWA capabilities and a deliberately designed local persistence and synchronization layer.
- **Validation:** Typed input validation at application boundaries, backed by database constraints.
- **Testing:** Unit, integration, authorization/RLS and browser end-to-end tests.
- **Delivery:** Automated checks and controlled deployment workflows.

Hosting provider selection remains open (D-013).

Before implementation, verify current supported versions, hosting compatibility, expected operating costs and the selected offline approach.

Do not add extra infrastructure, libraries or paid services without a clear requirement and documented justification.

## 4. Logical Architecture

The application should have clearly separated responsibilities.

### 4.1 Presentation layer

Responsible for screens, navigation, forms, accessible interaction and connectivity/synchronization indicators.

The browser is an untrusted environment. UI restrictions must never be treated as the primary security boundary.

### 4.2 Application and authorization layer

Responsible for:

- Authenticating the user.
- Resolving verified school membership.
- Checking permissions.
- Validating input.
- Applying business rules.
- Coordinating database operations.
- Handling errors and recording appropriate audit events.

Authorization must be performed for each protected operation.

### 4.3 Domain layer

Contains testable school-related rules, such as permitted state transitions, academic validation and workflow constraints.

Keep important business rules independent of presentation details where practical.

### 4.4 Data layer

Contains PostgreSQL tables, relationships, constraints, indexes, RLS policies and version-controlled migrations.

The database is authoritative for synchronized application records.

### 4.5 Storage and integrations

Handles private files and approved external services. Every integration must have defined permissions, data-sharing boundaries, failure behaviour and cost implications.

### 4.6 Offline synchronization layer

Handles approved local operations, queued writes, retries, idempotency and conflict detection.

Offline synchronization must not bypass server-side authorization or silently overwrite newer data.

### 4.7 Operations layer

Covers environment configuration, logging, monitoring, backups, recovery, automated checks and controlled releases.

## 5. Multi-Tenant Data Isolation

Each school is a tenant with its own logical workspace.

### Required safeguards

- Every tenant-owned record must have an explicit and documented ownership path.
- Tenant ownership must be enforced through database policies and server-side authorization.
- Relational constraints must prevent records belonging to different schools from being linked incorrectly.
- Access checks must cover database operations, file storage, reports, exports, background jobs and integrations.
- Membership removal must revoke access promptly.
- Platform-level privileges must be separate from ordinary school administration.

Never assume that filtering a query in the browser is sufficient.

Never assume that a valid authenticated session automatically authorizes access to every school.

### Supabase service-role credentials

Service-role credentials can bypass ordinary RLS protections. They must never be exposed in browser code.

Any privileged server-side operation must perform its own explicit authorization checks before accessing or modifying school data.

## 6. Authentication and Permission Model

Keep these concepts distinct:

- **Identity:** Which user is authenticated?
- **Membership:** Which school or schools is the user authorized to access?
- **Role and permissions:** Which actions may that user perform?
- **Module availability:** Which features are enabled for the school?
- **Record scope:** Which particular records may the user access?

These concepts must not be collapsed into a single client-controlled role or school identifier.

If multiple-school membership is supported, the active school context must be verified server-side for every protected operation. Membership in more than one school is excluded from the first release (D-017), but the model must retain the ability to add it later without redesign: membership stays explicit and separate from identity, and every protected operation continues to resolve and verify exactly one school server-side.

## 7. Modularity and Code Organization

Prefer clear domain boundaries within a modular application rather than introducing microservices prematurely.

Potential domains include:

- Authentication and membership.
- School configuration.
- Student records.
- Classes and subjects.
- Attendance.
- Assessment and results.
- Reporting.
- Finance, if approved.

Implement only the modules justified by validated requirements.

Keep shared security, validation, error handling and data-access conventions consistent across modules.

## 8. Offline-First Considerations

The platform should be designed for unreliable connectivity, but it should not cache every record or make every operation available offline.

### Static assets

Cache suitable application assets to improve loading where supported.

### Private data

Define which records may be stored locally, for what purpose and for how long. Avoid broad caching of authenticated API responses.

### Pending writes

Use stable operation IDs, idempotent processing and explicit synchronization states.

### Conflicts

Detect changes made elsewhere since a record was read. Use a documented conflict-resolution strategy appropriate to the data. Do not automatically apply last-write-wins to important academic or administrative records without an explicit decision.

### Revoked access

Recheck membership and permissions when queued operations synchronize. Define how cached data is cleared or restricted when users log out, switch schools or lose access.

Start with one low-risk offline workflow and expand only after testing.

## 9. Deployment and Environment Separation

Maintain distinct development/test and production environments.

Use a separate non-production Supabase project where feasible. Never use production student data as routine development or test data.

Keep secrets out of the repository and browser bundles. Document configuration variable names and purposes without recording secret values.

Automated checks should run before changes reach production.

## 10. Scalability and Future Isolation

The initial architecture should avoid unnecessary complexity while preserving future options.

If a particular school later needs dedicated infrastructure, a migration plan should cover:

- School identity and ownership mapping.
- Database and file transfer.
- Authentication and membership mapping.
- Downtime and synchronization considerations.
- Validation of record counts, relationships and file access.
- Security and permissions testing.
- Rollback or recovery procedures.

Do not create separate deployments pre-emptively without a demonstrated requirement.

## 11. Observability and Recovery

Monitor application failures, database performance, synchronization failures and operational capacity.

Logs must avoid secrets and unnecessary student information.

Establish backup, retention and restoration procedures. A backup must not be considered reliable merely because a backup job reports success; restore it in a non-production environment and verify its integrity.

## 12. Architecture Change Control

Record significant decisions in `docs/DECISIONS.md`.

For each major change, document:

- The problem being solved.
- The selected approach.
- Alternatives considered.
- Security and privacy implications.
- Cost and operational impact.
- Migration and recovery implications.
- Evidence that would justify revisiting the decision.

Before implementation begins, reconcile this document with the actual repository and confirm the chosen stack and deployment details. Do not claim proposed architecture is implemented until verified.
