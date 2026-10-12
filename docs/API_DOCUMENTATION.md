# API Documentation

**Project:** School Management Platform\
**Document status:** Initial functional requirements\
**Version:** 1.1

## 1. Purpose

This document defines the API design and integration rules for the school management platform.

It describes expected API behavior and security requirements. It is not a list of finalized endpoints. Actual endpoints, request schemas, and response schemas must be documented when the corresponding feature is approved for implementation.

## 2. API Architecture

The proposed application uses Next.js with TypeScript and Supabase. This stack must be confirmed before implementation.

Depending on the selected architecture, application operations may be implemented through:

- Next.js Route Handlers.
- Server Actions for appropriate application mutations.
- Supabase client operations protected by database RLS.
- Trusted server-side integrations and background processes.

Choose the appropriate mechanism for each operation. Do not introduce a separate API service unless there is a demonstrated architectural need.

Sensitive operations must be authorized on the server or enforced by database policies. Hiding a button or restricting a page in the frontend is not authorization.

## 3. API Design Principles

All API operations must follow these principles:

- Explicit authentication requirements.
- Server-side authorization.
- School-level tenant isolation.
- Strict input validation.
- Predictable response structures.
- Safe and consistent error handling.
- Minimal disclosure of sensitive information.
- Appropriate pagination and query limits.
- Idempotency for operations that may be retried.
- Clear documentation of side effects.
- Tests for both successful and rejected requests.

Use a consistent naming and response convention throughout the project.

## 4. Authentication and Authorization

### 4.1 Authentication

Use the selected authentication provider to establish the identity of the caller.

Every protected operation must validate the authenticated identity using a trusted mechanism appropriate to the selected framework and authentication configuration.

Do not trust user IDs, role names, school IDs, or membership claims supplied directly by the client without appropriate verification.

### 4.2 School membership

For a school-scoped operation, determine the school context and verify the caller's active membership.

A school identifier in a URL, form, request body, or client state identifies the requested context; it does not prove authorization.

### 4.3 Permissions

Authorization must consider the operation being performed, the target record, the active school, and the caller's permitted responsibilities.

Use explicit permission rules rather than scattered role-name checks that gradually become inconsistent.

A school administrator must not automatically receive platform-wide administrative access. Platform administration and school administration are separate trust boundaries.

### 4.4 Authorization failures

Requests from unauthenticated users must be rejected where authentication is required.

Requests from authenticated users who lack permission must be rejected without exposing protected data.

Choose `401 Unauthorized` for missing or invalid authentication and `403 Forbidden` where an authenticated caller lacks permission, subject to the framework's conventions and deliberate resource-concealment requirements.

## 5. Request Validation

Validate all untrusted input on the server, even when the frontend already validates it.

Validate:

- Required fields.
- Data types and permitted values.
- String lengths.
- Numeric ranges.
- Date and time formats.
- Identifier formats.
- Relationships between fields.
- School ownership and membership.
- File types and file sizes.
- Pagination limits.
- Any business rules relevant to the operation.

Reject unexpected or malformed input using a consistent error format.

Use an established schema-validation library if it fits the confirmed stack. Keep validation rules reusable where appropriate, but do not assume that frontend validation replaces server-side validation.

## 6. Response and Error Conventions

Define a consistent response convention before implementing multiple endpoints.

Successful operations should return the minimum information needed by the caller. Do not return entire database rows if they contain fields the caller should not see.

Errors should identify the general problem and, where safe, provide actionable validation details.

Do not expose:

- Database connection details.
- SQL statements or stack traces.
- Internal file paths.
- Secrets or access tokens.
- Private information about another school.
- Sensitive records merely to explain an authorization failure.

Log diagnostic details only in trusted server-side logging systems, subject to the privacy and retention policy.

Use appropriate HTTP status codes for validation failures, missing records, authorization failures, rate limits, conflicts, and unexpected server errors.

## 7. Pagination, Filtering, and Sorting

Lists of learners, attendance records, assessments, transactions, and other potentially large collections must support bounded queries.

Use a consistent pagination strategy. Cursor-based pagination is often preferable for large or frequently changing datasets, while offset-based pagination may be sufficient for smaller, stable lists.

Every school-scoped query must be constrained to the authorized school and permitted records.

Allow only documented filtering and sorting fields. Never interpolate arbitrary client-supplied SQL or order expressions into a query.

Apply reasonable maximum page sizes and avoid unbounded queries.

## 8. Idempotency and Concurrency

Operations may be retried because of network interruptions, slow responses, double-clicks, or mobile reconnection.

For operations where duplicate execution would cause harm, design idempotent behavior.

Examples include:

- Payment-provider callbacks.
- Fee payment recording.
- Attendance submissions.
- Background job processing.
- Notification dispatch.
- Bulk import operations.

Use database constraints, idempotency keys, provider event identifiers, transactions, or other appropriate mechanisms.

Define conflict behavior for simultaneous edits. Do not silently overwrite important changes without an approved concurrency strategy.

## 9. File Operations

File upload and download operations require explicit authorization.

Before accepting an upload, validate file size, permitted content types, ownership, and the intended purpose. Do not rely only on the filename or browser-supplied MIME type.

Store file metadata and enforce access rules for the underlying storage objects. A private database record does not make a publicly accessible storage object private.

Downloads must verify the caller's permission to access the file and its associated school record.

Use short-lived signed URLs where appropriate. Avoid long-lived public links for private learner or staff documents.

See `docs/SECURITY_AND_PRIVACY.md` for the broader file-security requirements.

## 10. External Integrations

External integrations must use trusted server-side credentials and verified callback mechanisms.

For payment integrations:

- Verify provider callback signatures or equivalent authenticity mechanisms.
- Validate transaction references and amounts against expected records.
- Handle duplicate callbacks safely.
- Record the provider's transaction identifier.
- Do not mark a payment successful solely because the browser reports success.
- Never store full card details or payment authentication secrets.

For email, messaging, and other integrations, validate destinations and permissions, handle failures safely, and apply rate limits where necessary.

Do not introduce a paid integration until its cost, availability, credentials, and operational requirements are understood.

## 11. Rate Limiting and Abuse Prevention

Apply appropriate rate limits and abuse controls to sensitive or expensive operations, including:

- Authentication-related endpoints.
- Password recovery and verification flows.
- Invitation and account creation flows.
- File uploads.
- Bulk imports and exports.
- Messaging and notification dispatch.
- Payment-related operations.

Choose limits based on the operation and expected usage. Do not claim rate limiting is active until it has been implemented and tested in the deployed environment.

## 12. API Versioning and Compatibility

Avoid introducing versioning complexity before it is necessary.

For the initial release, maintain a documented API contract and use backward-compatible changes where practical.

If external clients or integrations depend on a contract that cannot be changed safely, introduce an explicit versioning and deprecation strategy before breaking that contract.

Database migrations and application deployments must be coordinated to avoid incompatible intermediate states.

## 13. Logging and Observability

Log useful operational events, failures, and security-relevant actions without collecting unnecessary personal data.

Use a request or correlation identifier where practical so related events can be investigated.

Never log passwords, access tokens, secret keys, full payment credentials, or unnecessary sensitive learner information.

Distinguish expected validation or authorization failures from unexpected application failures.

## 14. API Documentation Requirements

For each implemented endpoint or server operation, document:

- Name and purpose.
- HTTP method and route, where applicable.
- Authentication requirements.
- Required school context.
- Required permission.
- Request schema.
- Response schema.
- Validation rules.
- Expected error conditions.
- Side effects.
- Idempotency and concurrency behavior.
- Rate limits, if applicable.
- Relevant database tables and storage resources.
- Tests covering success and rejection paths.

Document actual implemented behavior. Do not describe planned endpoints as operational.

### 14.1 `POST /api/admin/portal-credentials` — issue a one-time portal credential (implemented 2026-10-12)

- **Purpose:** an administrator issues a single-use activation or reset credential for a learner. The code is shown to the student once; the administrator never sees or sets the password.
- **Authentication:** Supabase session required (`auth.getUser()`, never an unverified cookie). Not signed in → `401`.
- **School context:** taken from the learner row (never from the request), so a caller cannot aim an authorised action at another school.
- **Required permission:** `learner.portal.manage` for the learner's school, checked via the `has_school_permission` RPC. → `403` otherwise.
- **Request schema:** `{ "learnerId": string, "purpose": "activation" | "reset" }`.
- **Response schema (201):** `{ "ok": true, "code": string, "expiresAt": ISO-8601, "purpose": string }`. The raw code is returned exactly once and is never stored or logged; only its HMAC is stored.
- **Validation rules:** both fields required; `purpose` must be one of the two values; missing/malformed → `400` `Invalid request.`; unknown learner → `404`.
- **Side effects:** for `activation`, provisions the learner's portal account (Auth identity + protected mapping) if missing; revokes any previous live credential for the same learner and purpose, then inserts the new hashed credential with an expiry (default 72 hours).
- **Idempotency/concurrency:** issuing again replaces the previous pending credential of the same purpose rather than stacking codes.
- **Rate limits:** session- and permission-gated; no additional limiter.
- **Database tables:** `learners`, `learner_portal_accounts`, `learner_portal_credentials`, `audit_events`.
- **Tests:** `tests/live/03-portal-flow.mjs` (401/403/400/201 paths) and unit tests for issuance logic.

### 14.2 `POST /api/portal/activate` — activate or recover with a one-time code (implemented 2026-10-12)

- **Purpose:** a student redeems a one-time activation code (or administrator-assisted recovery code) by choosing a password. The administrator never supplies or sees the password.
- **Authentication:** none (public endpoint); protected by code secrecy, atomic single-use and rate limiting.
- **Request schema:** `{ "code": string, "newPassword": string, "confirmPassword": string }`.
- **Response schema (200):** `{ "ok": true, "purpose": "activation" | "reset", "message": string }`.
- **Validation rules:** code normalised (formatting chars removed) and must match the generation alphabet with a minimum length; passwords must match; password length 8–72 characters (interim policy). Failures are **uniform**: an expired, used, revoked, malformed or unknown code all yield the same `400` message, so the endpoint cannot be probed.
- **Side effects:** the credential is claimed **atomically** (single-use) before the password is applied; if the password update fails, the claim is released so the student can retry.
- **Idempotency/concurrency:** concurrent submissions with the same code cannot both succeed.
- **Rate limits:** sliding window keyed by client address + code → `429` `Too many attempts…`.
- **Database tables:** `learner_portal_credentials` (claim), Auth `users` (password update).
- **Tests:** `tests/live/03-portal-flow.mjs` (single-use, expiry, mismatch, unknown code, uniform messages), unit tests for `parseActivateInput`.

### 14.3 `POST /api/portal/sign-in` — student sign-in (implemented 2026-10-12)

- **Purpose:** school-code + username + password sign-in (D-020). The server resolves `(school code, username)` to the internal account identifier through a protected mapping, then asks Supabase Auth to verify the password and issue the session.
- **Authentication:** none (public endpoint); protected by password verification, uniform failures and rate limiting. On success the Supabase session cookies are set via `@supabase/ssr` exactly as for any Supabase session.
- **Request schema:** `{ "schoolCode": string, "username": string, "password": string }`.
- **Response schema (200):** `{ "ok": true, "portal": "/portal" }`.
- **Validation rules:** school code normalised (trimmed, upper-cased, hyphens/spaces removed; ≤ 10 characters); username trimmed, lower-cased, ≤ 32 characters; password length ≥ 1 and ≤ 72 (correctness is decided by Auth).
- **Error behaviour:** a wrong school code, username or password all return the same `401` uniform message, and an unknown school code or username resolves to the same failure — no enumeration. Malformed input → `400`; unexpected server error → `500` with the same uniform message; rate limit → `429`.
- **Side effects:** issues/refreshes the session (sets cookies) on success.
- **Rate limits:** sliding window keyed by client address + `schoolCode:username` (identity-hashed, never logs the pair).
- **Database tables:** `schools`, `learners`, `learner_portal_accounts` (read); Auth sign-in.
- **Tests:** `tests/live/03-portal-flow.mjs` (success sets a session cookie; each wrong credential variant → uniform 401), unit tests for `parseSignInInput`.

## 15. Implementation Gate

Implement only the operations required for the selected end-to-end workflow.

Before considering an operation complete, test both permitted and forbidden access paths, including attempts to change the school identifier, target another school's record, submit malformed data, and repeat a sensitive operation.

Do not proceed to a broad API implementation until the core authorization pattern has been demonstrated to work.
