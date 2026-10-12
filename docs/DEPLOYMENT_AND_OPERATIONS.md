# Deployment and Operations

**Project:** School Management Platform\
**Document status:** Initial operational requirements\
**Version:** 1.1

## 1. Purpose

This document defines the deployment, environment, monitoring, backup, and maintenance requirements for the school management platform.

The initial deployment should be simple enough for a solo developer to operate reliably while preserving the ability to scale or isolate individual schools when justified.

Do not introduce unnecessary infrastructure before the product's real operational requirements are understood.

## 2. Initial Deployment Model

The initial target is:

- One primary application repository.
- One shared application deployment.
- One shared production Supabase project, subject to validation of the selected plan and security requirements.
- Logical school workspaces enforced by application authorization and database policies.
- A separate non-production environment for development and testing.
- Version-controlled migrations and repeatable deployment procedures.

This is the starting model, not a permanent restriction.

A school may move to dedicated infrastructure later if contractual, regulatory, performance, isolation, or operational requirements justify the additional cost and complexity.

Development begins on the Supabase Free plan. The Free plan is **not** a production configuration: its usage limits do not support real schools and its projects pause after inactivity. The production plan, its actual limits, and its cost must be reviewed and approved before any real school is onboarded. No paid service is committed by this document.

## 3. Technology and Hosting Validation

The proposed application stack includes Next.js, TypeScript, and Supabase PostgreSQL, Auth, and Storage.

Before implementation, verify:

- Current supported framework and runtime versions.
- Hosting compatibility with the selected Next.js features.
- Supabase project and plan limitations.
- Database connection and pooling behavior.
- Storage capacity and transfer limits.
- Authentication and email configuration.
- Background job requirements.
- Domain and HTTPS configuration.
- Backup and recovery capabilities.
- Expected costs under realistic usage.

Select hosting based on compatibility, security, operational simplicity, and total cost rather than familiarity alone.

Do not claim that a provider supports a feature or usage level until it has been verified.

Hosting status: development is fixed on the local Next.js setup and the existing `school-management-dev` project (D-013); **Vercel** is the proposed production application-hosting option, subject to compatibility and cost validation (D-013).

## 4. Environments

Keep development, testing, and production logically separate.

### 4.1 Development

Used for implementation and local verification.

- Use test accounts and synthetic data.
- Keep credentials outside source control.
- Apply migrations and validate changes before promotion.
- Avoid using real learner records for routine development.

### 4.2 Testing or staging

Use a separate non-production environment appropriate to the testing needs.

It should be sufficiently similar to production to test authentication, RLS, storage, migrations, and deployment behavior.

Use synthetic or appropriately anonymized data. Do not copy production personal data into staging without a reviewed and authorized process.

### 4.3 Production

Production contains real school data and must have stricter access and change controls.

- Limit access to authorized operators.
- Protect secrets.
- Monitor failures and unusual activity.
- Maintain a verified backup and recovery process.
- Apply reviewed migrations.
- Avoid debugging directly against real records when a non-production reproduction is possible.

Never assume that development and production share the same credentials, data, or permissions.

## 5. Configuration and Secrets

Use environment-specific configuration.

Keep real secrets out of Git, frontend bundles, documentation, logs, and agent prompts.

Maintain an `.env.example` with variable names and safe placeholders.

Before deployment, verify which variables are server-only and which are intentionally public. Never expose a Supabase service-role key or other privileged secret to client-side code.

Configure secrets through the hosting provider's supported secret-management mechanism.

If a required secret is missing, document the exact variable name and where the owner should configure it. Do not invent values or silently substitute production credentials with test credentials.

## 6. Source Control and Release Process

Use the primary repository as the authoritative source for application code, migrations, tests, and documentation.

A normal release should follow this sequence:

1. Review the intended changes.
2. Run formatting, linting, type checks, and relevant tests.
3. Review security-sensitive changes.
4. Test migrations against a non-production database.
5. Build the application.
6. Deploy to a non-production environment where appropriate.
7. Verify the affected workflows.
8. Obtain required authorization for production changes.
9. Deploy to production.
10. Run post-deployment smoke tests.
11. Monitor for errors and regressions.
12. Document the release and any known limitations.

Do not commit, push, deploy, or perform destructive operations without the authorization required by the project's agent workflow.

## 7. Database Migration Deployment

Database migrations must be version-controlled and tested before production.

Before applying a production migration:

- Understand its effect on existing records.
- Confirm tenant-isolation policies remain correct.
- Check whether application versions remain compatible.
- Identify whether the migration locks large tables or requires a long-running operation.
- Confirm backup and recovery arrangements.
- Obtain explicit authorization for destructive or high-risk changes.

Prefer additive, staged changes when they reduce deployment risk.

Do not assume that rolling back application code automatically rolls back a database migration safely.

For a failed migration, follow a documented recovery procedure rather than improvising destructive SQL against production.

## 8. Monitoring and Error Reporting

Monitor the application and its supporting services for:

- Availability and unexpected errors.
- Failed authentication flows.
- Database connection or query failures.
- Storage upload and download failures.
- Unexpected increases in resource usage.
- Background job failures, if background jobs are introduced.
- Payment or external integration failures, if those features are enabled.
- Security-relevant events and unusual access patterns.

Use a monitoring service only after reviewing its cost, privacy implications, access controls, and data collection behavior.

Do not send unnecessary learner data, credentials, tokens, or other secrets to monitoring providers.

Define who reviews alerts and what actions are expected when an alert fires.

## 9. Backups and Disaster Recovery

Before production launch, define and document:

- Backup method and frequency.
- Backup retention period.
- Where backups are stored.
- Who can access or restore them.
- Recovery Point Objective (RPO).
- Recovery Time Objective (RTO).
- Restoration procedure.
- Required post-restoration checks.
- Communication and escalation responsibilities.

Verify the capabilities and costs of the actual Supabase plan and any additional backup tooling.

Recovery Point Objective (RPO) and Recovery Time Objective (RTO) have **proposed initial production targets** (D-022: RPO 24 hours, RTO 24 hours). They are targets, not verified guarantees: verify that the chosen plan can meet them in a non-production restoration test, and verify the associated costs, before committing to them at production-readiness review.

Perform restoration tests in a non-production environment. A backup that has never been restored is not sufficient evidence of recoverability.

Any production restoration or recovery operation that could overwrite or lose data requires explicit authorization.

## 10. Capacity and Cost Management

Monitor actual usage before increasing infrastructure complexity.

Track relevant limits and costs, including:

- Database storage and compute.
- Database connections and query performance.
- File storage and bandwidth.
- Application hosting and build usage.
- Authentication and email usage.
- External API calls.
- Background processing, if introduced.
- Backup retention and recovery features.

Set reasonable budgets or alerts where the provider supports them.

Do not promise a specific number of supported schools or users without workload testing and an understanding of the chosen plan's limits.

## 11. Performance and Reliability

Measure performance using representative workflows and realistic data volumes.

Prioritize:

- Efficient database queries.
- Appropriate indexes.
- Bounded list queries and pagination.
- Avoiding redundant requests.
- Efficient rendering and asset delivery.
- Correct connection management.
- Safe handling of timeouts and retries.

Do not add caching that risks cross-school data leakage or stale authorization without a deliberate design and tests.

If caching is introduced, define the cache key, ownership boundaries, invalidation rules, and behavior after membership or permission changes.

## 12. Incident and Maintenance Procedures

Maintain documented procedures for:

- Application outage.
- Database failure.
- Suspected cross-school data exposure.
- Compromised account or secret.
- Failed migration.
- Accidental deletion or corruption.
- Storage exposure.
- External integration outage.
- Unexpected cost increase.

For security incidents, follow `docs/SECURITY_AND_PRIVACY.md`.

Apply dependency and framework updates deliberately. Review release notes, test compatibility, and prioritize security fixes according to their severity and exposure.

## 13. School Onboarding and Offboarding

School onboarding should be repeatable and secure.

Define the approved procedure for:

- Creating a school workspace.
- Assigning the first authorized administrator.
- Verifying school identity where required by the product.
- Configuring academic settings and modules.
- Inviting staff.
- Providing initial training.
- Confirming data access boundaries.

Offboarding must define how access is revoked, data is exported or retained where appropriate, and records are eventually deleted if authorized and required.

Do not permanently delete a school's records simply because a subscription or relationship ends. Follow approved contractual, legal, retention, and recovery requirements.

## 14. Future School-Specific Infrastructure

Dedicated infrastructure may be considered when a school's needs justify the additional operational burden.

Possible triggers include:

- Contractual or regulatory requirements.
- Materially different data-isolation requirements.
- Sustained workload that affects other schools.
- Custom integrations or deployment constraints.
- A demonstrated business case.

Before moving a school, define the data migration, authentication, file transfer, DNS or routing, backup, monitoring, rollback, and verification plan.

The shared architecture should avoid unnecessary coupling, but do not build a complex multi-database control plane before there is a real requirement.

## 15. Operational Documentation

Keep the following current as the system evolves:

- Environment setup instructions.
- Required configuration variable names.
- Migration and deployment instructions.
- Backup and restoration procedures.
- Monitoring and alert response instructions.
- School onboarding and offboarding procedures.
- Incident-response contacts and responsibilities.
- Known infrastructure limitations.
- Recovery and rollback instructions.

Do not include live secrets or sensitive production data in these documents.

## 16. Production Readiness Gate

Do not declare production readiness until:

- Authentication and authorization are verified.
- Cross-school isolation tests pass.
- Production configuration is reviewed.
- HTTPS and domain configuration are correct.
- Database migrations have been tested.
- Backups and restoration procedures are established.
- Monitoring and error handling are adequate.
- Required privacy and legal reviews have been addressed.
- A responsible operator can respond to failures.
- Post-deployment smoke tests are documented.

Production readiness is a verified operational state, not merely a successful deployment.
