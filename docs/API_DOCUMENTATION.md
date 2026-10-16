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

### 14.4 `POST /api/staff/sign-in` — staff sign-in (implemented 2026-10-12)

- **Purpose:** email + password authentication for staff (D-021, D-024). The server verifies the password with Supabase Auth, then resolves the school membership and role; the school is **never** taken from the request.
- **Authentication:** none (public endpoint); protected by password verification, uniform failures and rate limiting. On success the Supabase session cookies are set via `@supabase/ssr`.
- **Request schema:** `{ "email": string, "password": string }`.
- **Response schema (200):** `{ "ok": true, "role": "school_administrator" | "teacher" }`.
- **Validation rules:** email/password required; password length ≤ 72. Malformed input → `400`.
- **Error behaviour (uniform, no account enumeration):** wrong password or unknown email → `401` with one shared message; a valid account with no staff membership → `403` `not a school staff member`; a `revoked`/suspended membership → `403` `school access is not active`; multi-school membership (anomalous under D-017) fails closed to `500`; rate limit → `429`.
- **First-sign-in activation (fallback, D-025):** an `invited` membership flips to `active` on the first **confirmed** sign-in and writes a `staff_membership_activated` audit event attributed to the user. The normal path is acceptance at `/join` (see 14.9), which activates the membership directly; this fallback covers an interrupted acceptance. Supabase refuses password sign-in for unconfirmed emails, so a pending invitation cannot sign in before acceptance.
- **Rate limits:** sliding window keyed by client address + email (identity-hashed, never logged).
- **Database tables:** `school_members` (read/update), `audit_events` (insert); Auth sign-in.
- **Tests:** `tests/live/09-staff-auth.mjs`, unit tests for `parseStaffSignInInput` and `classifySignIn`.

### 14.5 `POST /api/staff/sign-out` — staff sign-out (implemented 2026-10-12)

- **Purpose:** clears the Supabase session cookies via the server client. Never touches membership rows; access decisions are always made per request by RLS and server-side checks.
- **Response schema (200):** `{ "ok": true }`.

### 14.6 `GET /api/staff/me` — current staff identity and school context (implemented 2026-10-12)

- **Purpose:** returns the caller's active school membership and role. The school comes from the signed-in session's membership row, never from the request.
- **Authentication:** Supabase session required (`auth.getUser()`, never an unverified cookie). No session → `401`.
- **Response schema (200):** `{ "ok": true, "userId": string, "role": string, "schoolId": string }`.
- **Denials:** an invited or revoked membership is invisible to RLS and is not staff → `403` (same message for a non-staff account); multiple active memberships → `403` (fail closed).
- **Database tables:** `school_members` (read, RLS-scoped).
- **Tests:** `tests/live/09-staff-auth.mjs`.

### 14.7 `POST /api/staff/invite` — invite a staff member with a shareable link (implemented 2026-10-15; D-025)

- **Purpose:** an authorized school administrator invites a staff member (D-018, D-024, D-025) and receives a shareable activation link. The invite is scoped to the **caller's own school** — no school identifier is accepted from the request, so an invite can never be aimed at another school. **No email is sent.**
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `member.manage` in the caller's own school, checked via `has_school_permission` RPC. No active/unique membership or missing permission → `403`.
- **Request schema:** `{ "email": string, "role": "school_administrator" | "teacher", "schoolId"?: string }` — `schoolId` is ignored entirely if supplied.
- **Response schema (201):** `{ "ok": true, "invitationId": string, "email": string, "role": string, "expiresAt": string, "activationLink": string }`, where `activationLink` is `<origin>/join#token=<64-hex>`. The token is returned exactly once and never logged. Duplicate email (an existing Auth account without an unaccepted invitation, or already a member of the school) → `409`; a non-staff role → `400`.
- **Side effects:** creates the auth user **unconfirmed** with no password and the `provisioned_by = 'school-platform'` marker (`school-accounts.createPendingStaffUser`; the sign-up guard hook requires that marker in the spoof-proof `app_metadata`). Inserts the `school_members` row with status `invited` through the caller's authenticated session, so RLS re-checks the permission and the audit trigger records the actor. Inserts a `staff_invitations` row (server-only store; only a keyed hash of the token) and appends a `staff_invitation_created` audit event.
- **Re-invitation:** if an unaccepted invitation already exists for `(school, email)`, the previous link is revoked and a new one issued, and the pending membership's role may be corrected. The old link stops working immediately.
- **Database tables:** Auth `users`, `school_members` (insert), `staff_invitations` (insert/update, server key), `audit_events` (insert).
- **Tests:** `tests/live/09-staff-auth.mjs` (401/400/403/201/409 paths, ignored `schoolId`, re-invite replacement).

### 14.8 `POST /api/staff/invitations/preview` — verify a shareable invitation link (implemented 2026-10-15; D-025)

- **Purpose:** verifies an activation link **without consuming it**, so the acceptance page can show the recipient, role, school and expiry before a password is chosen.
- **Authentication:** none (public); possession of the link is the credential. Rate-limited (`invitationLimiter`); exceeding it → `429`.
- **Request schema:** `{ "token": string }` (64 lower-case hex, sent in the body — never in the URL).
- **Response schema (200):** `{ "ok": true, "email": string, "role": string, "expiresAt": string, "schoolName": string | null }`.
- **Error behaviour (uniform):** a malformed token → `400`; an unknown, expired, revoked or already-used token → `404`, all with the same message, so a link cannot be probed.
- **Database tables:** `staff_invitations` (read, server key), `schools` (read).
- **Tests:** `tests/live/09-staff-auth.mjs`.

### 14.9 `POST /api/staff/invitations/accept` — accept a shareable invitation link (implemented 2026-10-15; D-025)

- **Purpose:** completes invitation acceptance. Claims the single-use credential atomically, sets the recipient's password and confirms the email through the admin API, and activates the membership. The school, recipient and role come from the stored invitation, never from the request, so acceptance cannot be redirected.
- **Authentication:** none (public); the single-use link is the credential. Rate-limited (`invitationLimiter`); exceeding it → `429`.
- **Request schema:** `{ "token": string, "password": string }` (password min 8 / max 72 characters, interim policy; sent in the body).
- **Response schema (200):** `{ "ok": true, "message": string }`.
- **Error behaviour:** a password that fails the interim policy → `400`; an unknown, expired, revoked or already-used link → `404` (uniform); a rare password-application failure → `500`.
- **Concurrency and single use:** the credential is claimed with a single conditional `UPDATE … RETURNING`, so two concurrent submissions cannot both succeed; on a password failure the claim is released so the same link can be retried. If only membership activation fails, the claim stays consumed and the first confirmed sign-in activates the membership (14.4 fallback).
- **Database tables:** `staff_invitations` (update/claim, server key), `school_members` (update), Auth `users` (password + `email_confirm`), `audit_events` (insert: `staff_invitation_accepted`).
- **Tests:** `tests/live/09-staff-auth.mjs` (400/404/200, single-use replay, confirmed email, activation).

### 14.10 `POST /api/staff/invitations/revoke` — revoke a live invitation (implemented 2026-10-15; D-025)

- **Purpose:** revokes a live (unaccepted, unrevoked) invitation so its shared link stops working immediately. Non-destructive: the pending account and `invited` membership remain dormant and unusable.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `member.manage` in the caller's own school, checked via `has_school_permission` RPC; the school is resolved from the caller's own active membership. Missing permission → `403`. Revoking an invitation that is not a live invitation of the caller's school → `404`, so a caller cannot revoke another school's invitation.
- **Request schema:** `{ "invitationId": uuid }`; a malformed id → `400`.
- **Response schema (200):** `{ "ok": true }`.
- **Database tables:** `school_members` (read, RLS-scoped, to resolve the caller's school), `staff_invitations` (update, server key), `audit_events` (insert: `staff_invitation_revoked`).
- **Tests:** `tests/live/09-staff-auth.mjs` (401/400/403/200/404, revoked link unusable, cross-school denial).

## 15. Implementation Gate

Implement only the operations required for the selected end-to-end workflow.

Before considering an operation complete, test both permitted and forbidden access paths, including attempts to change the school identifier, target another school's record, submit malformed data, and repeat a sensitive operation.

Do not proceed to a broad API implementation until the core authorization pattern has been demonstrated to work.
