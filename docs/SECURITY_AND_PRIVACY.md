# Security and Privacy

**Project:** School Management Platform\
**Document status:** Initial functional requirements\
**Version:** 1.1

## 1. Purpose

This document establishes security and privacy requirements for the school management platform.

The platform may process personal information about children, parents or guardians, teachers, school administrators, and other staff. Security and privacy must therefore shape the data model, authorization design, user interface, deployment, and operational procedures from the beginning.

These requirements are engineering guidance, not legal advice. Before production use, confirm the applicable Ghanaian legal and regulatory obligations with qualified advice.

## 2. Security Objectives

The platform must protect:

- **Confidentiality:** users can access only information they are authorized to see.
- **Integrity:** unauthorized users cannot alter, fabricate, or improperly delete school records.
- **Availability:** the system can recover from reasonable failures and disruptions.
- **Accountability:** sensitive administrative actions can be investigated.
- **Privacy:** personal data is collected, used, retained, and disclosed only for defined and authorized purposes.

Tenant isolation is a core security requirement, not a later enhancement.

## 3. Threat Model

The implementation must consider at least these threats:

1. A user from one school accesses another school's records.
2. A school user gains privileges beyond their assigned responsibilities.
3. A user manipulates a school ID, learner ID, class ID, or record ID in a request.
4. An attacker exploits a vulnerable authentication or account-recovery flow.
5. A database policy permits unauthorized reads or writes.
6. A service-role secret is exposed through client code, logs, or a repository.
7. A malicious or compromised user uploads an unsafe file.
8. A forged or replayed payment callback creates false financial records.
9. A cross-site scripting or injection vulnerability exposes data or permits unauthorized actions.
10. A stolen device exposes cached or downloaded school information.
11. An administrative mistake deletes or corrupts important records.
12. A backup, export, log, or monitoring service exposes personal data.
13. A third-party dependency or integration introduces a vulnerability.
14. A network interruption causes duplicate submissions or inconsistent records.
15. A compromised administrator account is used to access or modify sensitive data.

Document additional threats discovered during implementation and testing.

## 4. Data Minimization and Classification

Collect only the personal information necessary for approved features.

Do not add sensitive fields merely because they may be useful someday. Every additional field increases the privacy, security, retention, and breach-response burden.

Classify data according to sensitivity. At a minimum, distinguish:

- Public information.
- Internal operational information.
- Personal information.
- Sensitive or highly restricted information, including records that could create significant harm if disclosed.

Learner records, contact details, assessment results, attendance histories, and family information must not be treated as public data.

Avoid collecting medical, disability, biometric, financial, or other particularly sensitive information unless a defined feature and valid basis require it and appropriate safeguards have been approved.

## 5. Ghanaian Legal and Regulatory Review

Before production launch, assess the applicability of the Ghana Data Protection Act, 2012 (Act 843), and any other relevant legal or regulatory requirements.

Confirm, with qualified advice where necessary:

- Whether and how the responsible organization must register or otherwise comply with applicable requirements.
- The lawful basis and purpose for each category of personal data.
- Transparency and privacy-notice requirements.
- Requirements relating to children and information about guardians.
- Data-subject access, correction, objection, and deletion rights, where applicable.
- Retention and secure disposal requirements.
- Processor, hosting, and third-party service arrangements.
- International data transfers and cross-border processing.
- Breach reporting and notification obligations.
- Requirements for school agreements and responsibilities.

Do not assume that school approval alone resolves every privacy obligation. Do not represent the platform as legally compliant until the relevant assessment has been completed.

## 6. Authentication and Account Security

Use a supported authentication provider and secure session-handling practices.

Requirements include:

- Secure password handling through the authentication provider.
- Appropriate email or other identity verification.
- Safe account-recovery flows.
- Session expiration and revocation behavior.
- Protection against account enumeration where appropriate.
- Appropriate rate limits on authentication-related operations.
- Stronger authentication for privileged accounts where supported and justified.
- Secure handling of invitations and membership changes.
- Clear behavior when an account is disabled or a membership is revoked.

Never store plaintext passwords or implement a custom password-storage mechanism.

Do not rely on hiding routes, buttons, or navigation items to protect data.

**Self-registration control (verified 2026-10-12 against `school-management-dev`).** Public sign-up is disabled on the project, and a `Before User Created` Auth Hook refuses any account creation that the platform server did not provision (the server stamps `app_metadata.provisioned_by`). This protects the internal `students.invalid` identity namespace used by D-020 from being populated by any public path and is defence in depth behind the disabled sign-up setting. The hook runs on the sign-up path; the service-role admin API is protected by the server-only secret key and by this policy (server-mediated provisioning). Record: `docs/PHASE0_RISK_REGISTER.md` 10.4.

## 7. Authorization and Tenant Isolation

Use defense in depth:

1. Authenticate the caller.
2. Resolve the relevant school context.
3. Verify active membership.
4. Check the permission required for the operation.
5. Enforce database-level restrictions, including RLS.
6. Validate record ownership and relationships.
7. Return only the information the caller is permitted to access.

School-level permissions and platform-level administrative permissions must be separate.

Do not trust a role or school identifier supplied by the browser without trusted verification.

Test isolation using at least two separate schools with separate users and records. Include attempts to read, create, update, delete, export, and download records across school boundaries.

## 8. Secrets and Environment Variables

Secrets must remain in trusted server-side environments or approved secret-management systems.

Never commit real secrets to source control or expose them through browser bundles, public environment variables, screenshots, logs, or generated documentation.

Treat service-role keys, database credentials, payment-provider secrets, email-provider credentials, and signing secrets as highly restricted.

Maintain an `.env.example` containing placeholder names and safe example values only.

The coding agent must not read, print, copy, or disclose real `.env` files or secret values. If a task requires configuration, it should identify the required variable names and instruct the owner to configure them through the approved mechanism.

Public client configuration must be distinguished from actual secrets. A key being visible in client code does not make all associated backend resources safe; access must still be enforced by appropriate policies.

If a secret is accidentally exposed, stop using the compromised secret, rotate or revoke it through the provider, assess possible misuse, and document the remediation.

## 9. Application Security

Implement and test protections appropriate to the confirmed framework and deployment:

- Context-aware output encoding and XSS prevention.
- Parameterized database operations.
- Strict server-side input validation.
- Appropriate CSRF protections where relevant to the chosen authentication and request model.
- Secure session and cookie settings.
- Safe redirect handling.
- Access-control checks on every sensitive operation.
- Dependency vulnerability review.
- Safe error responses.
- Content Security Policy and other suitable security headers where compatible with the application.
- Protection against unintended mass assignment and over-posting of fields.

Avoid unsafe HTML rendering unless content is sanitized using a suitable, maintained approach and the use case has been reviewed.

Do not assume that a framework automatically protects every custom route or database operation.

## 10. File and Storage Security

Store private school documents in private storage locations with access controls.

Requirements include:

- Validate permitted file types and size limits.
- Do not trust filenames or client-supplied content types.
- Generate safe storage object names.
- Verify the user's permission before upload, download, replacement, or deletion.
- Ensure the file belongs to the authorized school and record.
- Avoid publicly readable links for private documents.
- Use short-lived signed URLs when appropriate.
- Consider malware scanning or other inspection for file types and risks that justify it.
- Prevent executable content from being served in an unsafe context.
- Define retention and deletion behavior for both database metadata and storage objects. The interim framework in D-023 applies until production policy is validated: no permanent deletion merely because a student leaves (leaving is recorded by enrolment state); access to inactive records is restricted; sensitive actions are audited; and no retention period is set without a documented purpose.

Test storage policies independently from database RLS. A protected database row does not automatically protect a storage object.

## 11. Privacy in Logs, Analytics, and Error Reporting

Collect only the telemetry required to operate and improve the service.

Do not send learner names, assessment results, contact details, or other sensitive school data to analytics or error-reporting services unless the data flow is justified, reviewed, and appropriately protected.

Never log credentials, authentication tokens, full payment credentials, or unnecessary personal information.

Use access controls and retention limits for logs. Review what information is sent to monitoring and analytics providers before enabling them in production.

## 12. Offline and Device Security

The application may be designed for low-connectivity environments, but offline access must be explicitly scoped and tested.

Do not cache all school records by default.

For every offline workflow, document:

- The specific data that may be stored locally.
- Who can access it on the device.
- Whether it is stored persistently.
- How long it remains available.
- How synchronization and conflicts are handled.
- What happens after logout, membership revocation, or school switching.
- How local data is cleared where feasible.
- What happens when the device is shared or lost.

Sensitive records must not be made available offline simply for convenience. The offline design must preserve authorization and data-integrity guarantees as far as technically possible.

## 13. Backups, Exports, and Data Recovery

Backups and exports are additional copies of sensitive data and must be protected accordingly.

Define:

- Who may initiate exports and backups.
- Which data each export contains.
- Where files are stored.
- How access is restricted.
- How long copies are retained.
- How copies are securely disposed of.
- How recovery is tested.
- How restoration affects audit history and consistency.

Before performing a production restore or destructive recovery operation, obtain explicit authorization and follow the documented recovery procedure.

## 14. Incident Response

Before production launch, define an incident-response process that includes:

1. Detect and record the incident.
2. Assess affected systems, schools, accounts, and data.
3. Contain the incident and revoke compromised access where necessary.
4. Preserve relevant evidence securely.
5. Restore safe operation.
6. Determine the root cause.
7. Assess legal, contractual, and notification obligations.
8. Communicate with affected parties as required.
9. Implement corrective measures.
10. Document lessons learned and verify the fixes.

Do not promise that a breach has been contained until the evidence supports that conclusion.

## 15. Security Testing and Release Gates

Before production, test at minimum:

- Cross-school access attempts.
- Role escalation attempts.
- Inactive membership access.
- RLS policies for reads and writes.
- File storage authorization.
- Authentication and account recovery.
- Input validation and injection defenses.
- Sensitive error and logging behavior.
- Secret exposure checks.
- Dependency and build checks.
- Backup restoration and recovery procedures.
- Relevant offline and synchronization behavior.

Use a dedicated non-production environment for destructive and security tests.

A passing test suite does not prove complete security. Record known limitations and unresolved risks.

## 16. Production Readiness

Do not launch with known critical authorization failures, cross-tenant data exposure, exposed secrets, or unreviewed destructive data operations.

Before launch, confirm that the privacy notice, data lifecycle rules, incident-response process, backups, access controls, and applicable legal review are complete enough for the intended use.

Security requirements must remain part of ongoing development, testing, deployment, and maintenance.
