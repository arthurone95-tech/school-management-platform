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

### 14.11 `GET /api/staff/invitations` — list a school's invitations (implemented 2026-10-16; D-025, D-026)

- **Purpose:** returns the most recent staff invitations for the caller's own school, newest first, each with a derived display status (`pending`, `accepted`, `expired`, `revoked`). This backs the dashboard invitation list.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `member.manage` in the caller's own school, checked via `has_school_permission` RPC; the school is resolved from the caller's own active membership, never from the request. Missing permission → `403`.
- **Request schema:** none.
- **Response schema (200):** `{ "ok": true, "invitations": [ { "invitationId": uuid, "email": string, "role": string, "status": "pending" | "accepted" | "expired" | "revoked", "issuedAt": iso8601, "expiresAt": iso8601, "acceptedAt": iso8601 | null, "revokedAt": iso8601 | null } ] }`. Credential hashes are never returned.
- **Bounded, not paginated:** returns at most the 200 most recent invitations (`STAFF_INVITATION_LIST_LIMIT`). Revisit if a school's invitation history grows.
- **Database tables:** `school_members` (read, RLS-scoped, to resolve the caller's school), `staff_invitations` (read, server key).
- **Tests:** `tests/live/10-staff-dashboard.mjs` (401 for no session, 403 for a teacher, 200 for an administrator, cross-school non-disclosure, derived `pending`/`accepted`/`revoked` statuses).

### 14.12 Staff-facing pages (implemented 2026-10-16; D-026, D-027)

- **`GET /sign-in`** — static page holding the staff sign-in form (`email` + `password`, posted to `POST /api/staff/sign-in`). It reads no cookies, so it stays prerendered.
- **`GET /dashboard`** — Partial Prerender: a static shell that streams the session-gated content behind a `<Suspense>` boundary (required by Cache Components), with prerendering stopped by `connection()` before the session read. An anonymous visitor receives the shell and a streamed redirect to `/sign-in`. A signed-in school administrator gets the invitation dashboard: create an invitation, copy the shareable link, see status and expiry, revoke, and re-invite. The page performs no authorization of its own; every action it calls repeats the identity, school and permission checks server-side. A permission-aware link to the students page is shown only when the caller holds `learner.read`.
- **`GET /dashboard/learners`** — Partial Prerender, same shell/redirect behaviour as `/dashboard`. A signed-in staff member who holds `learner.read` sees the school's students (paged, active by default); one who additionally holds `learner.create` sees the enrolment form. A caller holding `learner.update` can correct a record, deactivate or reactivate a student; one holding `learner.placement.manage` can move a student to another class. As with `/dashboard`, the page performs no authorization of its own; the endpoints it calls repeat every check server-side.
- **`GET /dashboard/classes`** — Partial Prerender, same shell/redirect behaviour as `/dashboard`. A signed-in staff member who holds `class.manage` manages the school's classes (create, rename, deactivate/reactivate). A caller without that permission is told their role cannot view classes. As with `/dashboard`, the page performs no authorization of its own; the endpoints it calls repeat every check server-side.
- **Tests:** `tests/live/10-staff-dashboard.mjs` (`/sign-in` renders; anonymous `/dashboard` streams a redirect to `/sign-in`; `/dashboard` renders for a signed-in administrator). `tests/live/11-enrolment.mjs` adds the same rendering checks for `/dashboard/learners`, including the enrolment form fields. `tests/live/12-administration.mjs` covers `/dashboard/classes` for an administrator and a permission-less teacher.

### 14.13 `GET /api/staff/classes` — list a school's classes (implemented 2026-10-16; D-027, D-028)

- **Purpose:** returns the caller's school classes for the enrolment form's class selector and for the class-management page.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `class.read` in the caller's own school, checked via `has_school_permission`; the school is resolved from the caller's own active membership, never from the request. Missing permission → `403`.
- **Request schema:** optional query `includeInactive` (the string `true` includes deactivated classes; anything else, or absence, returns active classes only).
- **Response schema (200):** `{ "ok": true, "classes": [ { "id": uuid, "name": string, "isActive": boolean } ] }`, ordered by name. The default active-only response keeps the enrolment selector unchanged (D-028).
- **Bounded:** one school has a small, bounded set of classes; no paging.
- **Database tables:** `school_members` (read, RLS-scoped), `classes` (read on the caller's session client, so Row Level Security scopes it to the caller's school).
- **Tests:** `tests/live/11-enrolment.mjs` (401 no session, 200 for an administrator, 403 for a permission-less teacher, cross-school non-disclosure). `tests/live/12-administration.mjs` adds the `includeInactive` behaviour (a deactivated class disappears from the default list and returns under `includeInactive=true`).

### 14.14 `GET /api/staff/learners` — list a school's students (implemented 2026-10-16; D-027, D-028)

- **Purpose:** returns a page of the caller's school students, newest first, each with the current class placement, backing the students list.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.read` in the caller's own school. Missing permission → `403`.
- **Request schema:** optional query `page` (positive integer, default `1`, capped at `10000`; non-numeric or below 1 becomes `1`); optional query `status` (`active` — the default — or `inactive`; any other value falls back to `active`). The default active-only view is how D-023's "not part of routine operational views" applies to the list (D-028).
- **Response schema (200):** `{ "ok": true, "learners": [ { "id": uuid, "username": string, "registrationNumber": string, "firstName": string, "lastName": string, "gender": string, "dateOfBirth": "YYYY-MM-DD", "status": string, "classId": uuid | null, "className": string | null } ], "page": number, "pageSize": number, "total": number }`. `pageSize` is `LEARNER_PAGE_SIZE` (25) and `total` is an exact count for the school. The list carries no address or guardian contact details; those are read one learner at a time (14.18).
- **Personal data:** the response contains a child's name and identifiers; it is returned only to a caller holding `learner.read` in that school (`docs/SECURITY_AND_PRIVACY.md` 4). Never cached (`Cache-Control: no-store`).
- **Database tables:** `school_members` (read, RLS-scoped), `learners` (read), `learner_class_placements` + `classes` (read, to resolve the current placement) — all on the caller's session client, so RLS is the boundary.
- **Tests:** `tests/live/11-enrolment.mjs` (401 no session, 200 for an administrator with the placement attached, 403 for a permission-less teacher, cross-school non-disclosure). `tests/live/12-administration.mjs` adds the `status` filter (a deactivated student leaves the default list and appears under `status=inactive`).

### 14.15 `POST /api/staff/learners` — enrol a student (implemented 2026-10-16; D-018, D-027)

- **Purpose:** registers a student in the caller's school and creates the initial class placement, in one request — the first end-to-end school workflow (D-018).
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.create` in the caller's own school. Missing permission → `403`.
- **Request schema (JSON):** `{ "registrationNumber": string (1–32, normalised, unique within the school), "firstName": string (1–80), "lastName": string (1–80), "gender": "male" | "female" | "other", "dateOfBirth": "YYYY-MM-DD" (a real date, not in the future, not before 1900), "residentialAddress": string (1–400), "guardianPhone": string (1–40), "guardianEmail": string (optional, valid email, max 254) | null, "classId": uuid (an active class in the caller's school) }`. Validation is in `src/lib/enrolment/requests.ts`.
- **Response schema (201):** `{ "ok": true, "learner": { …same shape as the list item… }, "completedExisting": boolean }`. `completedExisting` is `true` when an unplaced student with that registration number already existed and the placement was completed now (see Idempotency below).
- **Errors:** `400` invalid or missing field, or a `classId` that is not an active class in the caller's school; `409` the registration number is already used in the school (or already enrolled); `403` missing permission; `401` no session. Error bodies are `{ "ok": false, "error": string }` and never disclose another school's data.
- **Idempotency and partial failure (D-027):** PostgREST exposes no multi-statement transaction, so the learner insert and the placement insert are two calls. If the placement insert fails, the student exists without a placement; repeating the same request then **completes the placement** for that student instead of failing as a duplicate, and reports `completedExisting: true`. A repeat for an already-placed student is a `409`.
- **Authorization boundary:** the writes run on the caller's session client, not the server-only key, so Row Level Security on `learners` and `learner_class_placements` and the composite foreign keys (`placements_learner_school_fkey`, `placements_class_school_fkey`) enforce that the student, the class and the placement all belong to one school, independently of the handler.
- **Usernames:** generated server-side with the approved helpers; unique within the school; collisions resolved by numeric suffix and retried on a unique violation.
- **Database tables:** `school_members` (read), `classes` (read), `learners` (insert + read), `learner_class_placements` (insert). Audit triggers on `learners` and `learner_class_placements` record the change.
- **Tests:** `tests/live/11-enrolment.mjs` (201 create, 200 list, 409 duplicate, 400 invalid gender / future date of birth / another school's class, distinct usernames for identical names, 403 for a permission-less teacher, and the persisted tenant-consistent open placement).

### 14.16 `POST /api/staff/classes` — create a class (implemented 2026-10-16; D-028)

- **Purpose:** creates a class in the caller's school. This is the first class-administration write; the enrolment form previously only *selected* an existing class (D-027).
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `class.manage` in the caller's own school. Missing permission → `403`.
- **Request schema (JSON):** `{ "name": string (1–80, trimmed) }`. A blank or over-long name → `400`.
- **Response schema (201):** `{ "ok": true, "klass": { "id": uuid, "name": string, "isActive": true } }`.
- **Errors:** `400` invalid body; `409` a class with that name already exists in the school; `403` missing permission; `401` no session. Error bodies are `{ "ok": false, "error": string }`.
- **Uniqueness:** the database constraint `classes_school_name_key` is exact-match and includes deactivated classes, so the handler additionally rejects a name differing only in case (D-028); a name a deactivated class still holds is refused until that class is renamed.
- **Authorization boundary:** the insert runs on the caller's session client, so `classes_insert_managers` (which requires `class.manage`) is the real enforcement point.
- **Database tables:** `school_members` (read, to resolve the caller's school), `classes` (insert). The `classes` audit trigger records the insert.
- **Tests:** `tests/live/12-administration.mjs` (201 create, 409 exact duplicate, 409 case-only duplicate, 400 blank name, 403 for a permission-less teacher).

### 14.17 `POST /api/staff/classes/update` — rename, deactivate or reactivate a class (implemented 2026-10-16; D-028)

- **Purpose:** renames a class and/or sets its active flag. A class is retired by deactivation, never deleted: `learner_class_placements` references it `ON DELETE RESTRICT`, so past placements stay interpretable (D-023, `ENROLMENT_PERMISSION_MODEL` 5.2, 5.3). The application exposes no delete path.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `class.manage` in the caller's own school. Missing permission → `403`.
- **Request schema (JSON):** `{ "classId": uuid, "name"?: string (1–80), "isActive"?: boolean }`. At least one of `name` / `isActive` must be present → otherwise `400`.
- **Response schema (200):** `{ "ok": true, "klass": { "id": uuid, "name": string, "isActive": boolean } }`.
- **Errors:** `400` invalid body or no change requested; `404` the class does not exist in the caller's school (another school's class is indistinguishable); `409` the new name collides with another class (case-insensitively); `403`; `401`.
- **No-op writes:** setting the name or flag already in force writes nothing and returns the current class, so no empty audit event is produced.
- **Authorization boundary and audit:** the update runs on the caller's session client (`classes_update_managers`), scoped to the caller's school; the `classes` audit trigger records the changed column names.
- **Database tables:** `school_members` (read), `classes` (read + update).
- **Tests:** `tests/live/12-administration.mjs` (200 rename, 409 collision, 400 no-change, 200 deactivate, hidden from the default list, still listed with `includeInactive=true`, 200 reactivate, 404 another school's class, 403 for a teacher); the class-name uniqueness, class update policy and class audit trail are also checked against PGlite in `tests/database/enrolment-foundation.test.ts`.

### 14.18 `POST /api/staff/learners/detail` — read one student's full record (implemented 2026-10-16; D-028)

- **Purpose:** returns one student's full record — including residential address and guardian contact details — for the correction form.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.read` in the caller's own school. Missing permission → `403`.
- **Request schema (JSON):** `{ "learnerId": uuid }`. A missing or malformed id → `400`.
- **Response schema (200):** `{ "ok": true, "learner": { "id": uuid, "username": string, "registrationNumber": string, "firstName": string, "lastName": string, "gender": string, "dateOfBirth": "YYYY-MM-DD", "status": string, "classId": uuid | null, "className": string | null, "residentialAddress": string, "guardianPhone": string, "guardianEmail": string | null } }`.
- **Why `POST`:** the internal student id travels in the body so it never appears in a request line, and therefore never in an access log (`docs/SECURITY_AND_PRIVACY.md` 11) — the same reasoning that put the D-025 invitation credential in a fragment.
- **Personal data:** address and guardian contact details are returned for **one** learner at a time and are deliberately not added to the paged list, so listing a school does not disclose every child's address (`docs/SECURITY_AND_PRIVACY.md` 4). Never cached (`Cache-Control: no-store`).
- **Errors:** `400` invalid body; `404` the student does not exist in the caller's school (another school's student is indistinguishable); `403`; `401`.
- **Database tables:** `school_members` (read), `learners` + `learner_class_placements` + `classes` (read, on the caller's session client).
- **Tests:** `tests/live/12-administration.mjs` (200 with address and guardian details, 404 for another school's administrator, 403 for a permission-less teacher, 401 no session).

### 14.19 `POST /api/staff/learners/update` — correct a student record (implemented 2026-10-16; D-028)

- **Purpose:** applies a partial correction to a student's record under `learner.update`.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.update` in the caller's own school. Missing permission → `403`.
- **Request schema (JSON):** `{ "learnerId": uuid, "registrationNumber"?: string, "firstName"?: string, "lastName"?: string, "gender"?: "male" | "female" | "other", "dateOfBirth"?: "YYYY-MM-DD", "residentialAddress"?: string, "guardianPhone"?: string, "guardianEmail"?: string | null }`. Only the fields present are written; a blank `guardianEmail` or explicit `null` clears it. At least one field besides `learnerId` must be present → otherwise `400`. Field rules and messages are shared with enrolment (`src/lib/enrolment/requests.ts`).
- **Response schema (200):** `{ "ok": true, "learner": LearnerSummary }` (the corrected summary, without the correction-form-only fields).
- **Errors:** `400` invalid body, no fields, or a malformed field; `404` the student does not exist in the caller's school; `409` the registration number is already used in the school; `403`; `401`.
- **Not re-derived:** the `username` is the stable sign-in identifier (`ENROLMENT_PERMISSION_MODEL` 7) and is intentionally left unchanged by a correction; the response carries it unchanged.
- **Second approval:** corrections are applied immediately; second-approval remains **off**, the approved default (D-028; `ENROLMENT_PERMISSION_MODEL` 5.4).
- **Authorization boundary and audit:** the update runs on the caller's session client (`learners_update_managers`), scoped to the caller's school; the `learners` audit trigger records the changed column names but not their values.
- **Database tables:** `school_members` (read), `learners` (read + update).
- **Tests:** `tests/live/12-administration.mjs` (200 correction that leaves other fields and the username intact, 400 empty correction, 409 duplicate registration number, 404 another school's administrator, 403 for a teacher).

### 14.20 `POST /api/staff/learners/status` — deactivate or reactivate a student (implemented 2026-10-16; D-028)

- **Purpose:** sets a student's status to `active` or `inactive`. Deactivation is the state change for a student who leaves; the platform holds no delete policy on `learners`, so history stays intact (D-023, `ENROLMENT_PERMISSION_MODEL` 5.2).
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.update` in the caller's own school. Missing permission → `403`.
- **Request schema (JSON):** `{ "learnerId": uuid, "status": "active" | "inactive" }`. Any other status → `400`.
- **Response schema (200):** `{ "ok": true, "learner": LearnerSummary }`.
- **Errors:** `400` invalid body or unsupported status; `404` the student does not exist in the caller's school; `403`; `401`.
- **No-op writes:** setting the status already in force writes nothing and returns the current student.
- **Effect on the list:** `GET /api/staff/learners` returns active students only by default, so a deactivated student leaves the routine list and is reached through `?status=inactive` (D-023, D-028).
- **Authorization boundary and audit:** the update runs on the caller's session client (`learners_update_managers`), scoped to the caller's school; the `learners` audit trigger records the change.
- **Database tables:** `school_members` (read), `learners` (read + update).
- **Tests:** `tests/live/12-administration.mjs` (200 deactivate, removed from the default list and present under `status=inactive`, 200 idempotent repeat, 400 unsupported status, 200 reactivate, 404 another school's administrator, 403 for a teacher).

### 14.21 `POST /api/staff/learners/placement` — change a student's class (implemented 2026-10-16; D-028)

- **Purpose:** moves a student to another class by ending the current placement and opening a new one, keeping one current placement per learner (`ENROLMENT_PERMISSION_MODEL` 5.5).
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.placement.manage` in the caller's own school (the permission the `placements_update_managers` policy requires). Missing permission → `403`.
- **Request schema (JSON):** `{ "learnerId": uuid, "classId": uuid }`. A missing or malformed id → `400`.
- **Response schema (200):** `{ "ok": true, "learner": LearnerSummary, "unchanged": boolean }`. `unchanged` is `true` when the student was already in that class; then no placement row is written and `learner` is the current summary.
- **Errors:** `400` invalid body, or a `classId` that is not an active class in the caller's school (another school's class is refused); `404` the student does not exist in the caller's school; `409` the student is inactive, or a concurrent change left the one-open-placement slot occupied; `403`; `401`.
- **Order and recovery:** the current placement is ended first, then the new one is inserted, because no single-call transaction is available. If the insert fails, the student is left unplaced; repeating the request places them (this also repairs a partial enrolment from D-027). The partial unique index `placements_one_current_per_learner` guarantees one open placement even under a concurrent change; a unique violation is surfaced as `409`.
- **Authorization boundary:** both writes run on the caller's session client, so the `learner_class_placements` insert/update policies and the composite foreign keys (`placements_learner_school_fkey`, `placements_class_school_fkey`) keep the student and the class inside one school.
- **Database tables:** `school_members` (read), `learners` (read), `classes` (read), `learner_class_placements` (read + update + insert). Audit triggers on `learner_class_placements` record the change.
- **Tests:** `tests/live/12-administration.mjs` (200 move with exactly one open placement afterwards, 200 no-op for the current class, 409 inactive student, 400 another school's class, 404 unknown student, 404 another school's administrator, 200 recovery for a student with no placement, 403 for a teacher); the one-open-placement invariant is also checked against PGlite in `tests/database/enrolment-foundation.test.ts`.

### 14.22 `GET /api/staff/school` — read the caller's school profile (implemented 2026-10-16; D-029)

- **Purpose:** returns the school's name, code and status for the school settings page.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `school.manage` in the caller's own school. Missing permission → `403`. (Membership alone already lets staff read the school name via `schools_select_members`; this is the administration view.)
- **Response schema (200):** `{ "ok": true, "school": { "id": uuid, "name": string, "code": string, "status": string } }`.
- **Errors:** `500` if the profile cannot be loaded; `403`; `401`. Bodies are `{ "ok": false, "error": string }`.
- **Authorization boundary:** the read runs on the caller's session client, scoped to the school resolved from the caller's own active membership.
- **Database tables:** `school_members` (read), `schools` (read).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 read, 403 for a permission-less teacher, 401 anonymous).

### 14.23 `POST /api/staff/school/update` — rename the school (implemented 2026-10-16; D-029)

- **Purpose:** changes the school display name. The school **code is immutable** because students use it with a username to sign in (D-020).
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `school.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "name": string (2–120, trimmed) }`. A blank, too-short or over-long name → `400`.
- **Response schema (200):** `{ "ok": true, "school": { "id": uuid, "name": string, "code": string, "status": string } }`.
- **Errors:** `400` invalid body; `404` the school does not exist; `403`; `401`.
- **Authorization boundary:** the update runs on the caller's session client, so the new `schools_update_managers` policy (which requires `school.manage`) is the enforcement point; another school is not reachable.
- **Database tables:** `school_members` (read), `schools` (read + update). The `schools` audit trigger records the change.
- **Tests:** `tests/live/13-administration-settings.mjs` (200 rename with the code unchanged, 400 blank name, 403 for a teacher).

### 14.24 `GET /api/staff/academic-years` — list a school's academic years and terms (implemented 2026-10-16; D-029)

- **Purpose:** lists every academic year with its terms, for the school settings page.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `academic.read` in the caller's own school. Missing permission → `403`.
- **Response schema (200):** `{ "ok": true, "academicYears": [ { "id": uuid, "name": string, "startsOn": "YYYY-MM-DD", "endsOn": "YYYY-MM-DD", "isCurrent": boolean, "terms": [ { "id": uuid, "name": string, "startsOn": "YYYY-MM-DD", "endsOn": "YYYY-MM-DD" } ] } ] }`.
- **Errors:** `500` if the years cannot be loaded; `403`; `401`.
- **Database tables:** `school_members` (read), `academic_years` + `terms` (read, on the caller's session client).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 list, 403 for a teacher, 401 anonymous).

### 14.25 `POST /api/staff/academic-years` — create an academic year (implemented 2026-10-16; D-029)

- **Purpose:** creates a school-defined academic year with a label and start/end dates. Periods are stored, never assumed from a hard-coded calendar.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `academic.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "name": string (1–80, trimmed), "startsOn": "YYYY-MM-DD", "endsOn": "YYYY-MM-DD" }`. A malformed date, an impossible calendar date, or an end before the start → `400`. A new year is created **not current**.
- **Response schema (201):** `{ "ok": true, "academicYear": { "id": uuid, "name": string, "startsOn": "YYYY-MM-DD", "endsOn": "YYYY-MM-DD", "isCurrent": false, "terms": [] } }`.
- **Errors:** `400` invalid body; `409` a year with that label already exists in the school; `403`; `401`.
- **Authorization boundary:** the insert runs on the caller's session client (`academic_years_insert_managers`, which requires `academic.manage`), scoped to the caller's school.
- **Database tables:** `school_members` (read), `academic_years` (insert). Audit + `updated_at` triggers fire.
- **Tests:** `tests/live/13-administration-settings.mjs` (201 create, 409 duplicate label, 400 end-before-start, 403 for a teacher); the label uniqueness, one-current index and insert policy are also checked against PGlite in `tests/database/administration.test.ts`.

### 14.26 `POST /api/staff/academic-years/update` — rename, re-date or mark current an academic year (implemented 2026-10-16; D-029)

- **Purpose:** renames a year, changes its dates, and/or marks it current. Setting `isCurrent` true clears any other current year for the school first, so the partial unique index `academic_years_one_current_idx` is never violated.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `academic.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "academicYearId": uuid, "name"?: string (1–80), "startsOn"?: "YYYY-MM-DD", "endsOn"?: "YYYY-MM-DD", "isCurrent"?: boolean }`. At least one change must be present → otherwise `400`.
- **Response schema (200):** `{ "ok": true, "academicYear": AcademicYearSummary }` (the updated year with its terms).
- **Errors:** `400` invalid body, no change, malformed date or end before start; `404` the year does not exist in the caller's school (another school's year is indistinguishable); `409` the new label collides; `403`; `401`.
- **Authorization boundary and audit:** the writes run on the caller's session client (`academic_years_update_managers`), scoped to the caller's school; the `academic_years` audit trigger records the change.
- **Database tables:** `school_members` (read), `academic_years` (read + update).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 mark current, the previously current year cleared, 404 another school's administrator); the one-current rule is also checked against PGlite.

### 14.27 `POST /api/staff/terms` — add a term to an academic year (implemented 2026-10-16; D-029)

- **Purpose:** adds a term with a label and dates to one of the school's academic years.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `academic.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "academicYearId": uuid, "name": string (1–40, trimmed), "startsOn": "YYYY-MM-DD", "endsOn": "YYYY-MM-DD" }`. A malformed date, an impossible calendar date, or an end before the start → `400`.
- **Response schema (201):** `{ "ok": true, "term": { "id": uuid, "name": string, "startsOn": "YYYY-MM-DD", "endsOn": "YYYY-MM-DD" } }`.
- **Errors:** `400` invalid body, or an `academicYearId` that is not in the caller's school (the composite foreign key `terms_year_school_fkey` rejects it); `409` a term with that label already exists in the year; `403`; `401`.
- **Authorization boundary:** the insert runs on the caller's session client (`terms_insert_managers`); the term's `school_id` must equal the caller's school via the composite foreign key.
- **Database tables:** `school_members` (read), `terms` (insert). Audit + `updated_at` triggers fire.
- **Tests:** `tests/live/13-administration-settings.mjs` (201 create, 409 duplicate label, 403 for a teacher); the composite foreign key is checked against PGlite (`tests/database/administration.test.ts`).

### 14.28 `POST /api/staff/terms/update` — rename or re-date a term (implemented 2026-10-16; D-029)

- **Purpose:** renames a term or changes its dates.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `academic.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "termId": uuid, "name"?: string (1–40), "startsOn"?: "YYYY-MM-DD", "endsOn"?: "YYYY-MM-DD" }`. At least one change must be present → otherwise `400`.
- **Response schema (200):** `{ "ok": true, "term": { "id": uuid, "name": string, "startsOn": "YYYY-MM-DD", "endsOn": "YYYY-MM-DD" } }`.
- **Errors:** `400` invalid body, no change, malformed date or end before start; `404` the term does not exist in the caller's school; `409` the new label collides within the year; `403`; `401`.
- **Authorization boundary and audit:** the update runs on the caller's session client (`terms_update_managers`), scoped in the query and by RLS to the caller's school; the `terms` audit trigger records the change.
- **Database tables:** `school_members` (read), `terms` (read + update).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 rename, 404 another school's administrator).

### 14.29 `GET /api/staff/subjects` — list a school's subjects (implemented 2026-10-16; D-029)

- **Purpose:** lists the school's subjects, including deactivated ones so they can be reactivated.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `subject.read` in the caller's own school. Missing permission → `403`.
- **Response schema (200):** `{ "ok": true, "subjects": [ { "id": uuid, "name": string, "code": string | null, "isActive": boolean } ] }`.
- **Errors:** `500`; `403`; `401`.
- **Database tables:** `school_members` (read), `subjects` (read, on the caller's session client).
- **Tests:** `tests/live/13-administration-settings.mjs` (403 for a teacher, 401 anonymous).

### 14.30 `POST /api/staff/subjects` — create a subject (implemented 2026-10-16; D-029)

- **Purpose:** creates a school-scoped subject with an optional short code. New subjects are active.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `subject.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "name": string (1–80, trimmed), "code"?: string (1–20, trimmed) | null }`. A blank name or an over-long code → `400`. A blank code is stored as `null`.
- **Response schema (201):** `{ "ok": true, "subject": { "id": uuid, "name": string, "code": string | null, "isActive": true } }`.
- **Errors:** `400` invalid body; `409` a subject with that name already exists in the school; `403`; `401`.
- **Authorization boundary:** the insert runs on the caller's session client (`subjects_insert_managers`, which requires `subject.manage`), scoped to the caller's school.
- **Database tables:** `school_members` (read), `subjects` (insert). Audit + `updated_at` triggers fire.
- **Tests:** `tests/live/13-administration-settings.mjs` (201 create, 409 duplicate name, 403 for a teacher); uniqueness is checked against PGlite.

### 14.31 `POST /api/staff/subjects/update` — rename, re-code, activate or deactivate a subject (implemented 2026-10-16; D-029)

- **Purpose:** renames a subject, changes its code, or sets its active flag. A subject is **retired by deactivation, never deleted**; the application exposes no delete path.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `subject.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "subjectId": uuid, "name"?: string (1–80), "code"?: string (1–20) | null, "isActive"?: boolean }`. At least one change must be present → otherwise `400`. `"code": null` clears it.
- **Response schema (200):** `{ "ok": true, "subject": { "id": uuid, "name": string, "code": string | null, "isActive": boolean } }`.
- **Errors:** `400` invalid body or no change; `404` the subject does not exist in the caller's school; `409` the new name collides; `403`; `401`.
- **Authorization boundary and audit:** the update runs on the caller's session client (`subjects_update_managers`), scoped to the caller's school; the `subjects` audit trigger records the change.
- **Database tables:** `school_members` (read), `subjects` (read + update).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 deactivate, 200 reactivate, 404 another school's administrator, 403 for a teacher).

### 14.32 `GET /api/staff/members` — list a school's staff and their assignments (implemented 2026-10-16; D-029)

- **Purpose:** lists the school's staff memberships (with role and status) and each member's class/subject assignments, for the staff administration page.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `member.manage` in the caller's own school. Missing permission → `403`.
- **Response schema (200):** `{ "ok": true, "members": [ { "membershipId": uuid, "userId": uuid, "email": string | null, "role": string, "status": string, "assignments": [ { "id": uuid, "classId": uuid | null, "className": string | null, "subjectId": uuid | null, "subjectName": string | null } ] } ] }`.
- **Errors:** `500` if the members cannot be loaded; `403`; `401`.
- **Privileged read:** the membership rows and assignments are read on the caller's session client, so RLS scopes them to the caller's school. The member **email** lives in Supabase Auth, which PostgREST does not expose; the server-only secret key resolves it with `getUserById`, and only for the membership ids already read for that school — the privileged client cannot be pointed at another school (`docs/SECURITY_AND_PRIVACY.md` 4).
- **Database tables:** `school_members`, `staff_assignments`, `classes`, `subjects` (read, on the caller's session client) + `auth.users` (email, via the server-only secret key).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 list containing the administrator, school B's administrator cannot see school A's staff, 403 for a teacher, 401 anonymous).

### 14.33 `POST /api/staff/members/status` — suspend, restore or revoke a staff membership (implemented 2026-10-16; D-029)

- **Purpose:** applies the approved staff status change (D-023 pattern): `suspend`, `restore` (to active) or `revoke`. A membership is a state change, **never a hard delete**: `has_school_permission` ignores a non-active membership, so a suspended or revoked member loses access immediately.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `member.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "membershipId": uuid, "action": "suspend" | "restore" | "revoke" }`. Any other action → `400`.
- **Response schema (200):** `{ "ok": true, "status": "active" | "suspended" | "revoked" }`.
- **Errors:** `400` invalid body; `404` the membership does not exist in the caller's school (another school's membership is indistinguishable); `403`; `401`.
- **No-op writes:** setting the status already in force returns the current status and writes nothing, so a repeat writes no empty audit event.
- **Authorization boundary and audit:** the update runs on the caller's session client (`school_members_update_managers`), scoped to the caller's school; the `school_members` audit trigger records the change. `has_school_permission` already ignores a non-active membership, so access is lost on the next request.
- **Known limitation:** there is no last-administrator guard, so an administrator can suspend or revoke their own membership; this follows the D-023 pattern exactly and is recorded in D-029.
- **Database tables:** `school_members` (read + update).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 suspend, the status visible in the list, 200 restore, 200 revoke with the row retained, 404 another school's administrator, 403 for a teacher); a suspended administrator losing read access is checked against PGlite.

### 14.34 `POST /api/staff/assignments` — assign a staff member to a class and/or subject (implemented 2026-10-16; D-029)

- **Purpose:** links a membership to a class and/or a subject inside one school.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `assignment.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "membershipId": uuid, "classId"?: uuid, "subjectId"?: uuid }`. At least one of `classId` / `subjectId` must be present (a blank string counts as absent) → otherwise `400`.
- **Response schema (201):** `{ "ok": true, "assignmentId": uuid }`.
- **Errors:** `400` invalid body, no target, or a class/subject id that is not in the caller's school (the composite foreign keys `staff_assignments_class_school_fkey` / `staff_assignments_subject_school_fkey` reject it); `409` the same assignment already exists; `404` the membership does not exist in the caller's school; `403`; `401`.
- **Authorization boundary:** the insert runs on the caller's session client (`staff_assignments_insert_managers`); the composite foreign keys keep the membership, class and subject in one school, so a cross-school id fails the constraint instead of crossing the tenant boundary.
- **Database tables:** `school_members` (read), `staff_assignments` (insert). Audit + `updated_at` triggers fire.
- **Tests:** `tests/live/13-administration-settings.mjs` (201 create, 409 duplicate, 400 no target, 400 another school's class, the assignment appears on the member, 403 for a teacher); the composite foreign keys and unique index are checked against PGlite.

### 14.35 `POST /api/staff/assignments/delete` — remove a staff assignment (implemented 2026-10-16; D-029)

- **Purpose:** removes a class/subject assignment from a staff member. Unlike the records it links, an assignment is a relationship, so removing it is a legitimate delete.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `assignment.manage`. Missing permission → `403`.
- **Request schema (JSON):** `{ "assignmentId": uuid }`.
- **Response schema (200):** `{ "ok": true }`.
- **Errors:** `400` invalid body; `404` the assignment does not exist in the caller's school (another school's assignment is indistinguishable); `403`; `401`.
- **Authorization boundary:** the delete runs on the caller's session client (`staff_assignments_delete_managers`), scoped to the caller's school; the audit trigger records it.
- **Database tables:** `school_members` (read), `staff_assignments` (delete).
- **Tests:** `tests/live/13-administration-settings.mjs` (200 remove, 404 unknown id, 403 for a teacher).

### 14.36 `GET /dashboard/school` and `GET /dashboard/staff` — administration pages (implemented 2026-10-16; D-029)

- **Purpose:** the session-gated server-rendered pages that drive the new endpoints above. `/dashboard/school` shows the school profile, academic years and terms, and subjects; `/dashboard/staff` shows members and their assignments with suspend / restore / revoke.
- **Authentication:** a prerenderable shell streams its session-dependent part behind `<Suspense>`; an anonymous visitor receives a redirect to `/sign-in`. The pages read no data themselves beyond the gate; the browser calls the API routes, which repeat every identity, school and permission check.
- **Authorization:** the page is a user-experience gate only; each control is shown only when the caller holds the relevant permission (`school.manage`, `academic.read`/`academic.manage`, `subject.read`/`subject.manage`, `member.manage`, `assignment.read`/`assignment.manage`). The API and Row Level Security remain the enforcement boundary.
- **Tests:** `tests/live/13-administration-settings.mjs` (anonymous redirect for both pages).

### 14.37 `GET /api/staff/attendance/options` — the caller's classes and subjects (implemented 2026-10-17; D-030)

- **Purpose:** returns the classes the caller may take attendance for, and when `classId` is given, the subjects they may use in that class.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `attendance.read` in the caller's own school. Missing permission → `403`.
- **Response schema (200):** `{ "ok": true, "classes": [ { "id": uuid, "name": string, "isActive": boolean } ], "subjects": [ { "id": uuid, "name": string, "code": string | null } ] }`. `subjects` is empty when no `classId` is supplied.
- **Errors:** `500`; `403`; `401`.
- **Least privilege:** this is deliberately **not** `GET /api/staff/classes`. A teacher holds no `class.read` or `subject.read` (those stay administrator-only), so this endpoint reads through the `accessible_classes` and `class_subjects` functions, which are `SECURITY DEFINER` and gated on `can_access_class`. A teacher therefore sees the classes they are assigned to and their own subjects within them; RLS on `classes` and `subjects` is not bypassed for anybody, because the functions apply the same scope test. No learner data is exposed here.
- **Database tables:** `school_members`, `classes`, `staff_assignments`, `subjects` (read through the gated functions).
- **Tests:** `tests/live/14-attendance.mjs` (200 for both roles, an empty picker for a teacher assigned to no class, a teacher not receiving the whole subject catalogue, 403/401).

### 14.38 `GET/POST /api/staff/attendance/sessions` — list and open registers (implemented 2026-10-17; D-030)

- **Purpose:** `GET` lists the registers on a date (defaulting to today); `POST` opens one.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `GET` `attendance.read`; `POST` `attendance.record`. Missing permission → `403`.
- **Request schema (POST, JSON):** `{ "classId": uuid, "sessionDate": "YYYY-MM-DD", "subjectId"?: uuid }`. A missing or malformed class → `400`; a malformed or future date → `400` ("Attendance cannot be recorded for a future date").
- **Response schemas:** `GET` → `{ "ok": true, "sessions": [ { "id": uuid, "classId": uuid, "className": string, "subjectId": uuid | null, "subjectName": string | null, "sessionDate": "YYYY-MM-DD", "notes": string | null, "recordedCount": number, "isCorrectable": boolean } ] }`; `POST` → `201` with `{ "ok": true, "session": AttendanceSessionSummary }`.
- **Errors:** `400` invalid body; `404` the class is not one the caller may attend — an unassigned class for a teacher, another school's class for anybody; `409` a register for that class, date and subject already exists; `403`; `401`.
- **Teacher scope and cross-school behaviour:** the school comes from the caller's own membership, never the request, and both queries run on the caller's session client under policies gated on `can_access_class`. An out-of-scope class is therefore a `404`, identical to one that does not exist.
- **Duplicate prevention:** `attendance_sessions_one_per_class_date_subject_idx` — the same register cannot be opened twice.
- **`isCorrectable`:** false when the date is in the past and the caller is not an `attendance.report` holder. It is advisory for the interface; the server refuses the write regardless.
- **Tests:** `tests/live/14-attendance.mjs` (201, 409 duplicate, 404 unassigned class, 404/400 cross-school, 400 future date, 400 missing class, 403/401, and the listing filtered to the caller's own classes).

### 14.39 `GET/POST /api/staff/attendance/register` — read and write a register (implemented 2026-10-17; D-030)

- **Purpose:** `GET` returns the register for one session (roster plus what has been marked); `POST` writes the whole register.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `GET` `attendance.read`; `POST` `attendance.record`, and additionally `attendance.correct` when marks already exist. Missing permission → `403`.
- **Request schema (POST, JSON):** `{ "sessionId": uuid, "entries": [ { "learnerId": uuid, "status": "present" | "absent" | "late" | "excused", "note"?: string | null } ] }`. At least one entry, at most 200; a repeated `learnerId` → `400`; an unknown status → `400`; a note over 200 characters → `400`.
- **Response schemas:** `GET` → `{ "ok": true, "detail": { "session": AttendanceSessionSummary, "roster": [ { "learnerId": uuid, "registrationNumber": string, "fullName": string, "status": ... | null, "note": string | null } ] } }`; `POST` → `{ "ok": true, "detail": ... }` (the register is read back after writing).
- **Errors:** `400` invalid body, or a learner who is not currently in the class; `404` the session is not the caller's (another class, or another school) — never a hint that it exists; `409` the correction window is closed for a teacher; `403`; `401`.
- **The register is submitted whole.** Every learner currently in the class must be marked exactly once. A partial submission is refused because an incomplete register is indistinguishable from a complete one and would silently understate absence. Existing marks are updated and new ones inserted, so re-saving unchanged marks is idempotent.
- **Correction window (business rule, enforced server-side):** a teacher may write a register only while its date is still today; a holder of `attendance.report` (an administrator) may correct any date. A closed window is `409`, reported separately from a permission failure so the interface can explain it.
- **Least privilege:** the roster comes from the gated `class_roster` function, which returns only id, registration number and name. A teacher holds no `learner.read`, and no other learner attribute crosses this endpoint.
- **Idempotency and auditing:** writes upsert by `(session_id, learner_id)`; every change is written to `audit_events` by the `audit_row_change` trigger with its actor. There is no delete path — attendance is a record, not a state.
- **Database tables:** `school_members`, `attendance_sessions`, `attendance_records`, `learner_class_placements` and `learners` (read through `class_roster`), `classes`, `subjects`.
- **Tests:** `tests/live/14-attendance.mjs` (200 read and write, 404 cross-school read, 400 unknown status / repeated learner / unknown learner, 409 correction window for a teacher with the same register shown read-only, 200 administrator correction of a past register, 403/401, and the audit assertions).

### 14.40 `GET /api/staff/attendance/report` — per-class attendance report (implemented 2026-10-17; D-030)

- **Purpose:** aggregates one class's attendance over a bounded window, as status totals and a per-learner breakdown.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `attendance.report`, granted to `school_administrator` only. A teacher → `403`. This is deliberate: a teacher's class-scoped attendance permissions must not extend to the school-wide view.
- **Query parameters:** `classId` (uuid, **required**), `from` and `to` (`YYYY-MM-DD`, each defaulting to today). A missing or malformed class → `400`; an end before the start → `400`; a window of 366 days or more → `400`.
- **Response schema (200):** `{ "ok": true, "report": { "classId": uuid, "className": string, "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "sessionCount": number, "totals": [ { "status": ..., "count": number } ], "learners": [ { "learnerId": uuid, "registrationNumber": string, "fullName": string, "present": number, "absent": number, "late": number, "excused": number, "sessionsRecorded": number } ] } }`.
- **Errors:** `400`; `404` the class is not visible to the caller (another school, or nonexistent); `403`; `401`.
- **Bounding:** the window is capped at `ATTENDANCE_MAX_REPORT_DAYS` (366) and learners at `ATTENDANCE_MAX_RECORDS` (200) per register, so no unbounded attendance aggregation is possible (`docs/AGENTS.md` 6).
- **Authorization boundary:** counts are computed from rows the caller's own session client can read. A class outside their school is invisible to it, so the report cannot disclose another school's attendance. A learner who has since changed class still appears under the class the attendance was taken in, which is what a register is a record of.
- **Tests:** `tests/live/14-attendance.mjs` (200 with totals matching what was recorded and a per-learner breakdown, 403 for a teacher, 404 for another school's class, 400 for a missing class and for an unbounded window, 401).

### 14.41 `GET /dashboard/attendance` — attendance page (implemented 2026-10-17; D-030)

- **Purpose:** the session-gated server-rendered page behind the endpoints above: take a register for a class, subject and date, mark every learner, and — for an `attendance.report` holder — build a class report.
- **Authentication:** a prerenderable shell with the session-dependent part behind `<Suspense>`; an anonymous visitor is redirected to `/sign-in`. A caller holding neither `attendance.record` nor `attendance.read` is redirected to `/dashboard`.
- **Authorization:** the page is a user-experience gate only. The browser calls the API routes, which repeat every identity, school, permission and scope check, and `can_access_class` is the boundary that holds.
- **Tests:** `tests/live/14-attendance.mjs` (the streamed redirect for an anonymous visitor).

### 14.42 `GET/POST /api/staff/grade-bands` — the school's own grading scale (implemented 2026-10-18; D-031)

- **Purpose:** lists and adds a school's grading bands. `docs/PRD.md` 11 records grading as differing between schools and unvalidated, so the platform stores a scale and never assumes one.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `GET` `grade.read` (the teacher also holds it — marking against a scale you cannot see is not workable); `POST` `grade.manage`, administrator only. Missing permission → `403`.
- **Request schema (POST, JSON):** `{ "minPercentage": number 0-100, "label": string 1-20, "remark"?: string ≤120 | null, "isPassing": boolean }`. A percentage outside 0–100 or a non-number → `400`; a blank label → `400`.
- **Response schema:** `GET` → `{ "ok": true, "bands": [ { "id": uuid, "minPercentage": number, "label": string, "remark": string | null, "isPassing": boolean } ] }`; `POST` → `201` with `{ "ok": true, "band": ... }`.
- **Errors:** `400` invalid body; `409` the band already exists at that minimum, **or** it would fall inside an existing band's range; `403`; `401`.
- **The overlap rule:** a band owns `[min, next min)`. Adding one inside an existing range is refused because it would silently regrade scores already recorded — a 65 previously graded "D6" would become "C4". Only extending the scale downward, or editing a band, is allowed. The unique index cannot see a range overlap, so this is checked in the server operation.
- **Tests:** `tests/live/15-results.mjs` (201, 400 out of range, 409 overlap, 409 duplicate, 403 for a teacher, 401).

### 14.43 `POST /api/staff/grade-bands/update` — relabel, re-mark or remove a band (implemented 2026-10-18; D-031)

- **Purpose:** changes a band's label, remark or passing flag, or removes it, behind `grade.manage`. **Removing a band cannot rewrite history**: a stored result keeps its score and percentage, so removal only affects future grading.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `grade.manage`, administrator only. Missing permission → `403`.
- **Request schema (JSON):** `{ "bandId": uuid, "label"?: string, "remark"?: string | null, "isPassing"?: boolean }`, at least one change; or `{ "bandId": uuid, "action": "delete" }`.
- **Response schemas:** update → `{ "ok": true, "band": GradeBand }`; delete → `{ "ok": true }`.
- **Errors:** `400` invalid body or no change; `404` the band is not in the caller's school; `403`; `401`.
- **Tests:** `tests/live/15-results.mjs` (200 re-mark, 403 for a teacher on both update and delete, 401).

### 14.44 `GET/POST /api/staff/assessments` — a class's assessments (implemented 2026-10-18; D-031)

- **Purpose:** `GET` lists assessments behind `assessment.read`; `POST` creates one behind `assessment.manage`. `?includeInactive=true` also returns retired ones; the default is active-only.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** as above; missing permission → `403`.
- **Request schema (POST, JSON):** `{ "classId": uuid, "name": string 1-80, "maxScore": number >0 ≤99999.99, "assessedOn": "YYYY-MM-DD", "subjectId"?: uuid, "termId"?: uuid, "notes"?: string ≤200 }`. A missing class, a non-positive or oversized maximum, a malformed date, or a future date → `400`.
- **Response schemas:** `GET` → `{ "ok": true, "assessments": [ { "id", "classId", "className", "subjectId", "subjectName", "termId", "name", "maxScore", "assessedOn", "notes", "isActive", "markedCount", "learnerCount" } ] }`; `POST` → `201` with `{ "ok": true, "assessment": AssessmentSummary }`.
- **Errors:** `400` invalid body; `404` the class is not one the caller may teach; `409` a constraint conflict; `403`; `401`.
- **Teacher scope:** the read and the insert run on the caller's session client under policies gated on `can_access_class`, so a teacher sees and creates assessments only for their assigned classes — the same boundary attendance uses (migration 0006).
- **Tests:** `tests/live/15-results.mjs` (201, 400 no class, 400 future date, 404 unassigned class, 404/400 cross-school, cross-school listing empty, 401).

### 14.45 `POST /api/staff/assessments/update` — rename, re-date or retire an assessment (implemented 2026-10-18; D-031)

- **Purpose:** changes an assessment's name, maximum, date, notes or active flag, behind `assessment.manage`, scoped by `can_access_class`. Retired by `isActive: false`, following the retire-by-deactivation pattern (D-028, D-029); marks already recorded are kept.
- **Authentication:** Supabase session required. No session → `401`.
- **Request schema (JSON):** `{ "assessmentId": uuid, ... }` with at least one of `name`, `maxScore`, `assessedOn`, `notes`, `isActive`. A future `assessedOn` → `400`.
- **Response schema (200):** `{ "ok": true, "assessment": AssessmentSummary }`.
- **Errors:** `400` invalid body, no change, or a future date; `404` the assessment is not the caller's; `409` the new maximum is below a mark already recorded — rejected by the score trigger, so marks are never silently invalidated; `403`; `401`.
- **Tests:** `tests/live/15-results.mjs` (200 retire, 400 marks refused afterwards, marks still present, 401).

### 14.46 `GET/POST /api/staff/results` — read and record a result sheet (implemented 2026-10-18; D-031)

- **Purpose:** `GET` returns one assessment's sheet — the class roster with each learner's mark, percentage and the grade the school's bands give it — behind `assessment.read`. `POST` writes the whole sheet behind `result.record`.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `GET` `assessment.read`; `POST` `result.record`. Missing permission → `403`.
- **Request schema (POST, JSON):** `{ "assessmentId": uuid, "entries": [ { "learnerId": uuid, "score": number | null, "remark"?: string ≤200 } ] }`. At least one entry, at most 200; a repeated `learnerId` → `400`; a non-numeric or negative score, or one above the assessment maximum, → `400` with the bound named.
- **Response schema (200):** `{ "ok": true, "sheet": { "assessment": AssessmentSummary, "entries": [ { "learnerId", "registrationNumber", "fullName", "score", "percentage", "grade", "remark" } ], "isEditable": boolean } }`.
- **Errors:** `400` invalid body, a learner who is not in the class, or a retired assessment; `404` the assessment is not the caller's; `403`; `401`.
- **Whole-sheet submission:** every learner currently in the class must be marked exactly once. A partial sheet is refused because an incomplete one is indistinguishable from a complete one and would silently understate results. Writes upsert by `(assessment_id, learner_id)`, so re-saving unchanged marks is idempotent.
- **Least privilege:** the roster comes from the gated `class_roster` function, so marking needs no `learner.read` and exposes no learner field beyond id, registration number and name.
- **No delete:** a mark is corrected by writing it again, and every change is audited.
- **Tests:** `tests/live/15-results.mjs` (200 read and write, 404 cross-school, 400 above maximum / repeated learner / unknown learner, grade resolved from the school's bands, a zero mark given no invented grade, read-only once retired, 404 for an unassigned teacher, 401).

### 14.47 `GET /api/staff/reports/academic` — the class academic summary (implemented 2026-10-18; D-031)

- **Purpose:** a class's assessments with average, highest, lowest and pass counts, plus a per-learner average and best grade. This is the "academic summaries and reports" area of Phase 4.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `report.read`, **administrator only**. A teacher → `403`, deliberately: class-scoped `assessment.read` must not widen into a whole-class view.
- **Query parameters:** `classId` (uuid, **required**), `from` and `to` (`YYYY-MM-DD`, optional). A missing or malformed class → `400`; an inverted window → `400`.
- **Response schema (200):** `{ "ok": true, "report": { "classId", "className", "from", "to", "gradingIsConfigured": boolean, "assessments": [ { "assessmentId", "name", "maxScore", "assessedOn", "averagePercentage", "highestPercentage", "lowestPercentage", "passedCount", "markedCount", "learnerCount" } ], "learners": [ { "learnerId", "registrationNumber", "fullName", "averagePercentage", "bestGrade", "assessmentsTaken" } ] } }`.
- **Errors:** `400`; `404` the class is not visible to the caller; `403`; `401`.
- **The averages are explicitly unweighted** arithmetic means of the marked percentages, and `gradingIsConfigured` is `false` when the school has no bands, so the interface can say so plainly. Weighting is a grading rule `docs/PRD.md` 11 records as unvalidated.
- **Tests:** `tests/live/15-results.mjs` (200, marked count matches, `gradingIsConfigured` true, 403 for a teacher and for an unassigned teacher, 404 cross-school, 400 no class, 401).

### 14.48 `GET /dashboard/results` — assessments, marks and the class summary (implemented 2026-10-18; D-031)

- **Purpose:** the session-gated page behind the endpoints above. Shows the assessments for a chosen class, records marks, and — for a `report.read` holder — the class summary.
- **Authentication:** a prerenderable shell with the session-dependent part behind `<Suspense>`; an anonymous visitor is redirected to `/sign-in`, and a caller with neither `assessment.read` nor `report.read` is redirected to `/dashboard`.
- **Authorization:** a user-experience gate only. A row shows "no grade scale configured" rather than a blank when the school has no bands.
- **Tests:** `tests/live/15-results.mjs` (the streamed redirect).

### 14.49 `GET /api/staff/export` — CSV export (implemented 2026-10-18; D-032)

- **Purpose:** exports the school's data as CSV. `?kind=learners` gives the whole roll with the current class; `?kind=attendance` or `?kind=results` with `classId`, `from` and `to` gives one class's sheet over a window.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.export` for `kind=learners`; `report.export` for the class sheets. Both are administrator-only. Missing permission → `403`. Export deliberately does **not** ride on `learner.read`, because an export carries addresses and guardian phone numbers out of the system.
- **Response schema (200):** `text/csv; charset=utf-8` with `Content-Disposition: attachment`, `Cache-Control: no-store` and an `X-Row-Count` header. Not a JSON body.
- **Errors:** `400` a missing class, a malformed or inverted window, a window of 366 days or more, or an unknown `kind`; `500` the export could not be produced; `403`; `401`.
- **Bounds:** at most 5000 rows and a window capped at 366 days, so an export cannot become an unbounded read.
- **Audited:** every export calls `record_data_export`, a `SECURITY DEFINER` function that appends to `audit_events` with `auth.uid()` as the actor. The caller cannot supply or omit the actor, and a caller with no active membership cannot record the event at all, so it cannot happen.
- **CSV safety:** a value beginning `=`, `+`, `-`, `@`, tab or CR is written with a leading apostrophe, so a spreadsheet cannot execute it as a formula — a child's name is untrusted input.
- **Database tables:** `learners`, `learner_class_placements`, `classes` (learners); `attendance_sessions`, `attendance_records` (attendance); `assessments`, `assessment_results` (results). All read on the caller's session client.
- **Tests:** the CSV rules are covered by 34 unit tests and the audit behaviour by the PGlite suite. **This endpoint is not yet live-verified.**

### 14.50 `POST /api/staff/import/learners` — bulk learner import (implemented 2026-10-18; D-032)

- **Purpose:** imports a learner's existing class list from CSV.
- **Authentication:** Supabase session required. No session → `401`.
- **Required permission:** `learner.import`, administrator only. Missing permission → `403`.
- **Request schema (JSON):** `{ "csv": string }`, the raw file text. A missing or empty `csv`, an unparseable file, a file missing a required column, or more than 100 usable rows → `400`; a body over 2 MB → `413`.
- **Required columns:** `registration_number`, `first_name`, `last_name`, `gender`, `date_of_birth`, `residential_address`, `guardian_phone`, `class_name`. Optional: `guardian_email`. Matching ignores case, spaces and underscores. A missing **required** column refuses the file; unknown columns are reported as ignored.
- **Response schema (200):** `{ "ok": true, "created": number, "completedPlacement": number, "failed": number, "results": [ { "row": number, "registrationNumber", "learnerId", "created": boolean, "message": string | null } ], "issues": [ { "row": number, "registrationNumber", "message" } ], "ignoredColumns": string[] }`.
- **Per-row reporting:** rows are validated independently and every row is reported with its **file line number**, so a school fixes specific lines and re-imports rather than starting over. A class name that is not an existing active class is an issue on that row, not a learner created without one.
- **No new write path:** each row is validated by `parseEnrolmentInput` and written by `enrolLearner` — the same parser and operation as the single-student form — on the caller's session client, so RLS, the composite foreign keys and the uniqueness constraints apply unchanged.
- **Tests:** 34 CSV and import unit tests. **Not yet live-verified.**

### 14.51 `GET /dashboard/data` — import and export page (implemented 2026-10-18; D-032)

- **Purpose:** the session-gated page behind the export and import endpoints, showing the exact expected header row and a worked example, and listing every imported row with its line number.
- **Authentication:** a prerenderable shell with the session-dependent part behind `<Suspense>`; an anonymous visitor is redirected to `/sign-in`, and a caller with none of the three permissions is redirected to `/dashboard`.
- **Authorization:** a user-experience gate only; the file is read in the browser and posted to this application's own server and nowhere else.

## 15. Implementation Gate

Implement only the operations required for the selected end-to-end workflow.

Before considering an operation complete, test both permitted and forbidden access paths, including attempts to change the school identifier, target another school's record, submit malformed data, and repeat a sensitive operation.

Do not proceed to a broad API implementation until the core authorization pattern has been demonstrated to work.
