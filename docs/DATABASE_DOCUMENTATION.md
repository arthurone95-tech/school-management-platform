# Database Documentation

**Project:** School Management Platform\
**Document status:** Initial functional requirements\
**Version:** 1.1

## 1. Purpose

This document defines the database design principles, tenant-isolation requirements, data integrity rules, and migration standards for the school management platform.

It describes the required logical model. It does **not** declare a finalized database schema. The implementation agent must validate the proposed entities and relationships against the PRD, feature specifications, system architecture, and security requirements before creating migrations.

## 2. Database Technology

The proposed database is PostgreSQL through Supabase.

Before implementation, verify the supported PostgreSQL version, Supabase capabilities, and current platform limitations.

The database is the authoritative source for persistent application data. Client-side state and cached data must never override database authorization or integrity rules.

## 3. Multi-Tenant Data Model

The platform will initially use one shared production database for multiple schools.

Each school must have an isolated logical workspace. Users must only access school records permitted by their active membership and role.

### 3.1 Core logical entities

The following entities are candidates for the initial model. They must be refined during schema design.

- **Schools:** school identity, status, contact information, and school-level configuration.
- **User profiles:** application-level user information associated with an authenticated identity.
- **School memberships:** relationship between users and schools, including membership status and school-specific roles.
- **Academic years:** academic periods configured by each school.
- **Terms:** terms belonging to the appropriate academic year and school.
- **Classes:** school-defined class groups, with appropriate academic-year relationships.
- **Subjects:** subjects configured for the school's curriculum.
- **Class enrollments:** relationships between learners and classes.
- **Staff assignments:** relationships between staff, classes, subjects, or other responsibilities.
- **Learner records:** learner-specific information that the platform is authorized to store.
- **Attendance records:** learner attendance by date, class, and applicable session.
- **Assessment records:** assessment definitions, results, and relevant academic periods.
- **Fees and payment records:** financial obligations and transactions, if included in the enabled modules.
- **Announcements and notifications:** school-scoped communication records.
- **Audit events:** security-relevant and administrative activity records.
- **File metadata:** references to uploaded documents, including ownership and storage location.

Not every entity must be implemented in the first release. Follow the approved roadmap and build only what is needed for the selected end-to-end workflow.

## 4. Tenant Ownership and Isolation

### 4.1 Ownership requirements

Every school-owned record must have a clearly defined school ownership path.

For most tenant-owned tables, prefer an explicit, non-null `school_id` where it improves authorization clarity, query safety, indexing, and auditability.

Where ownership is inherited through a parent relationship, document how the database enforces the relationship and how authorization determines the owning school.

### 4.2 Cross-school integrity

The database must prevent relationships between records belonging to different schools.

For example, a class enrollment must not connect a learner from School A to a class from School B.

Use appropriate foreign keys and, where needed, composite unique constraints and composite foreign keys to enforce tenant-consistent relationships.

Application-level checks alone are insufficient for critical tenant-isolation guarantees.

### 4.3 School membership

A user's membership in one school does not grant membership in another school.

Membership must be represented explicitly. A user may belong to multiple schools only if the product supports that arrangement and each school is independently authorized.

Membership status and role must be checked when granting access. Revoked, suspended, or inactive memberships must not continue to authorize access.

### 4.4 School selection

A school ID submitted by a browser or mobile client is untrusted input.

The server must validate the authenticated user's membership and permission for the requested school. Database policies must independently enforce applicable access restrictions.

## 5. Authentication and Database Authorization

Use Supabase Auth for authentication if the proposed stack is confirmed.

Authentication establishes identity; it does not automatically establish school membership or permission to access a record.

### 5.1 Row-Level Security

Enable PostgreSQL Row-Level Security (RLS) on all exposed tables containing private or tenant-owned data.

For each table, define and test policies for the operations that are actually required:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`

Policies must enforce school ownership, membership status, role permissions, and record-specific constraints where applicable.

Do not enable broad policies merely to make the frontend work.

Tables used only by trusted server-side processes must still have deliberate access controls and must not become publicly accessible through an exposed API.

### 5.2 Service-role credentials

Supabase service-role credentials can bypass ordinary RLS protections. They must never be placed in browser code, mobile bundles, public environment variables, or client-accessible responses.

Use elevated database access only in trusted server-side environments. Validate identity, membership, and authorization explicitly before executing privileged operations.

### 5.3 Database functions

Database functions that read or modify sensitive data must have deliberate execution permissions and a reviewed security model.

Where a function uses elevated privileges, validate inputs, restrict execution grants, and ensure it cannot be used to bypass school isolation.

## 6. Data Integrity

Use database constraints rather than relying exclusively on frontend validation.

Where appropriate, implement:

- Primary keys.
- Foreign keys.
- `NOT NULL` constraints.
- Unique constraints.
- Check constraints.
- Appropriate numeric precision for financial values.
- Valid date and time relationships.
- Tenant-consistent relationships.
- Unique constraints preventing duplicate records where duplicates are invalid.

Define expected behavior for duplicate attendance submissions, repeated payment callbacks, conflicting updates, and simultaneous edits.

For financial records, use appropriate exact numeric types rather than floating-point arithmetic for currency amounts. Define currency explicitly where relevant.

Do not assume that a record can be safely deleted merely because the user interface offers a delete button. Apply the approved retention, audit, and relationship rules.

## 7. Indexing and Query Performance

Create indexes based on expected query patterns and measured performance.

Likely candidates include:

- `school_id` on tenant-owned tables.
- Foreign-key columns used in joins.
- School-scoped class and academic-year lookups.
- Learner attendance by learner, class, and date.
- Assessment results by assessment and learner.
- Membership lookups by user and school.
- Timestamps used for chronological lists.
- Unique identifiers used for idempotency.

Avoid creating every possible index without justification. Excessive indexes increase write costs and storage use.

Review query plans and performance using realistic data volumes before optimizing prematurely.

## 8. Migrations and Schema Changes

All production schema changes must be represented by version-controlled database migrations.

Migrations must be:

- Ordered and reproducible.
- Reviewed before production application.
- Safe for existing data or accompanied by an explicit data-migration plan.
- Tested against a non-production database.
- Compatible with the relevant application deployment strategy.

Do not edit production schema manually as a substitute for recording the change in version control.

For breaking changes, use a staged migration where practical: add the new structure, migrate or backfill data, update application code, verify behavior, and remove obsolete structures only after confirming they are no longer required.

Never run destructive migrations, bulk deletion, or irreversible data transformations against production without explicit authorization and a verified recovery plan.

## 9. Data Lifecycle and Deletion

Define lifecycle rules for learners, staff, schools, memberships, attendance, assessments, financial records, and uploaded documents.

Distinguish between:

- Deactivating an account or record.
- Archiving a record.
- Removing a relationship.
- Permanently deleting personal data.
- Retaining records where there is a valid legal or operational basis.

Avoid cascading deletion of important academic, financial, or audit records unless the behavior has been deliberately approved.

Support export and deletion workflows only after verifying authorization, retention requirements, dependencies, and the consequences for linked records.

## 10. Auditability

Record security-relevant and sensitive administrative actions, including appropriate changes to school configuration, membership, permissions, learner records, and financial records.

Audit events should capture enough information to investigate an event, such as:

- Acting user or trusted system actor.
- School context, where applicable.
- Action performed.
- Target record type and identifier.
- Timestamp.
- Outcome.
- A minimal, safe record of relevant change details where justified.

Do not store passwords, access tokens, full payment credentials, or unnecessary sensitive learner data in audit logs.

Ordinary application users must not be able to modify or erase security audit history through normal application permissions.

## 11. Backups and Recovery

Before production launch, establish:

- The actual backup and recovery capabilities of the selected hosting plan.
- Backup frequency and retention.
- Recovery Point Objective (RPO): acceptable data loss measured in time.
- Recovery Time Objective (RTO): acceptable time to restore service.
- Responsibility for initiating recovery.
- A documented recovery procedure.
- Periodic restoration tests.

Do not treat the existence of a backup setting as proof that recovery works.

Confirm whether point-in-time recovery is available and affordable on the selected plan. If unavailable, document the limitation and approved mitigation.

Recovery Point Objective (RPO) and Recovery Time Objective (RTO) are **not yet agreed**. They remain open for production-readiness review and must not be assumed, committed to, or represented as met until agreed and verified by a restoration test.

## 12. Testing Requirements

Database tests must cover:

1. Authorized users can access permitted records.
2. Users without membership cannot access a school's private records.
3. A user from School A cannot read or modify School B's records.
4. Client-supplied school IDs cannot bypass authorization.
5. Cross-school foreign-key relationships are rejected.
6. Inactive or revoked memberships lose access.
7. Unauthorized inserts, updates, and deletes are rejected.
8. Duplicate and concurrent operations behave correctly.
9. Migrations work against a clean database and a representative existing database.
10. Backups can be restored according to the recovery plan.

Use isolated test data and a dedicated non-production database for automated tests that modify database state.

## 13. Implementation Gate

Do not create a large speculative schema before the first workflow is selected.

First identify the workflow's entities, relationships, authorization rules, constraints, and required queries. Implement the smallest complete schema that supports the approved workflow safely.

Document unresolved schema decisions before making assumptions that could affect data integrity or future migrations.
