# Enrolment Field, Identifier and Permission Model

**Project:** School Management Platform\
**Document status:** Sections 4, 7 and 8 approved; section 5 approved defaults; section 6 provisional except the initial role set (approved, D-021); section 9 has one open item (E1)\
**Version:** 0.5\
**Date:** 2026-10-12\
**Scope:** Student enrolment, class placement, and student portal account access (D-018, D-019, D-020, D-021)

## 1. Purpose and Standing

This document separates four things that are otherwise easy to confuse:

1. **Mandatory platform safeguards** — security, tenant isolation, data integrity. Not configurable, not optional. Section 4.
2. **Documented implementation defaults** — safe choices that let development proceed without knowing every school's preferences. Section 5.
3. **Approved field, identifier and account model** — recorded as D-019. Sections 7 and 8.
4. **Provisional school-specific policy** — approval chains, class rules. Unverified, configurable, revisable. Section 6. (The **initial role set** is no longer provisional — approved by D-021; see 5.1.)

Governing documents win over anything here: `docs/FEATURE_SPECIFICATIONS.md` 3, `docs/SYSTEM_ARCHITECTURE.md` 6, `docs/SECURITY_AND_PRIVACY.md` 7, `docs/DATABASE_DOCUMENTATION.md` 4.2.

## 2. Reference-System Findings

Evidence base: code and documentation inspection of **two** systems — **YAW Academy** and **Tina's Little Angels Preparatory School**.

**These findings are reference evidence, not rules every school must follow.** The investigation did **not** verify live database behaviour and did **not** establish universal policies for Ghanaian schools.

| Finding | How this document uses it |
|---|---|
| Enrolment fields: first name, last name, email, class, date of birth, gender, parent phone, address, active status, student ID | Input to the field model in section 7. The approved set differs from it — see 7.1 |
| Administrators create student accounts | Supports an administrator-led registration and activation model (section 8) |
| Records can be deactivated; permanent deletion is restricted | **Supports the default** in 5.2 — deactivate, do not hard-delete |
| Class placement is free text, with no enforced capacity, age, or prerequisite rules | **Not adopted as free text.** See 5.3 — free text conflicts with data integrity |
| Curricula and grading labels differ between the systems | Confirms school-specific variation is real. Grading remains out of scope |
| No universal staff-role structure; no validated approval process for corrections | **Partially resolved 2026-10-12.** The initial role set is decided (D-021, section 5.1); the approval-process details remain provisional (sections 6 and 9) |
| Separate Firebase projects; no shared multi-tenant architecture | Evidence of a gap in the reference systems. Our shared-deployment model is D-003/D-004 and is unchanged |

**On Firebase:** the reference systems use it. That is not a reason to revisit D-015. Supabase was selected over Firebase because Postgres RLS, composite foreign keys and exact numeric types are binding requirements in `docs/DATABASE_DOCUMENTATION.md` 4.2, 5.1 and 6. Adopting a per-school-project model would also contradict D-003 and D-004.

## 3. Status of This Document

| Part | Status |
|---|---|
| Section 4 — mandatory safeguards | **Binding.** Not negotiable per school |
| Section 5 — implementation defaults | **Approved defaults** (D-019 and owner approval, 2026-10-11). The initial role set in 5.1 is owner-approved (D-021, 2026-10-12). Revisable without a schema redesign |
| Sections 7 and 8 — fields, identifiers, account access | **Approved** (D-019) |
| Section 8.4 — student portal authentication approach | **Approved** (D-020, 2026-10-11) |
| Section 6 — school-specific roles, approval chains, class structure | **Provisional** — except the initial role set (5.1, approved D-021); approval-policy and permission details remain unvalidated |
| Section 9 — unresolved decisions | **Open** unless marked otherwise |

## 4. Mandatory Platform Safeguards

**Not configurable. Not optional. Not affected by any school preference.**

- Every protected operation authenticates the caller, resolves school membership, and checks permission **server-side**.
- **School isolation is enforced in the database.** RLS on every tenant-owned table, with policies for insert, select, update and delete defined separately.
- A learner and a class must belong to the **same school**, enforced by a composite foreign key — not application code (`docs/DATABASE_DOCUMENTATION.md` 4.2).
- Client-supplied school IDs, user IDs and role names are untrusted input and never authorize anything.
- Revoked or inactive membership loses access immediately, including through an existing session.
- The privileged service credential stays server-side and never appears in a `NEXT_PUBLIC_` variable or the client bundle.
- Every change to a membership, role or permission is audited.
- Every correction to an enrolment record produces an audit event, **regardless of any approval policy**.
- Administrator-assisted password resets and activation events are audited (section 8.3).
- Personal data about children is minimised, access-restricted, and exports are restricted.
- Module availability is checked server-side. Hiding enrolment in navigation is not enforcement.

## 5. Documented Defaults

Safe defaults approved so that development can proceed without knowing every school's preferences. Each is a starting point, not a permanent requirement.

### 5.1 Initial role set, data-driven permissions

The **initial role set** is approved (D-021, 2026-10-12): **Platform Owner, School Administrator, Teacher, and Student**. Parent/Guardian access is **deferred**. This replaces the earlier interim default of *school administrator + school staff* (2026-10-11); redeploying the interim pair would contradict D-021.

Permissions are stored as **data** (`role_permissions`), never hard-coded role names. The four labels may be referenced by name in authorization code, but each role's actual authority comes from the permission catalogue. Initial scope and school boundary per role:

- **Platform Owner** — platform-level, **cross-school** administrative capability. Capabilities are a narrow, enumerated set (for example creating and configuring schools and platform settings). Access to student or school records is **not** unrestricted: it requires explicit, scoped authorization for the specific operation and is **audited**; the label alone never bypasses school isolation or RLS.
- **School Administrator** — **exactly one school** (its `school_members` row). Manages that school's own members, enrolment records, class configuration, portal activation/recovery, and settings. No cross-school capability.
- **Teacher** — **exactly one school**. School-scoped teaching role. By default the teacher is assigned **no** permissions; each approved feature seeds its own teacher permission (for example, view of own-class rosters) through the catalogue.
- **Student** — **exactly one school** (D-017) and only the student's **own** records (own profile, own portal data, own report cards when implemented). A student session never has staff-level permissions.

Adding headteacher, registrar or parent/guardian later remains configuration, not a schema change, subject to owner approval.

### 5.2 Deactivate, do not delete

A learner has a status of `active` or `inactive`. The enrolment workflow performs **no hard delete**. Supported by the finding that records are deactivated and deletion restricted, and consistent with `docs/DATABASE_DOCUMENTATION.md` 9 on retention. Permanent deletion remains subject to an approved retention and deletion policy before production. An interim retention framework is approved (D-023): leaving a school is recorded by state, never by permanent deletion; access to inactive records is restricted and sensitive actions (deactivation, reactivation, and access to or export of inactive records) are audited; and no retention period is set without a documented purpose. Specific periods, and Ghanaian legal and school-specific obligations, remain to be validated before real-school onboarding.

### 5.3 Classes are school-scoped entities, not free text

Class placement is **free text** in the reference systems. That is not adopted. Free text permits typos, near-duplicate class names, and unreportable rosters, which conflicts with `docs/DATABASE_DOCUMENTATION.md` 6.

Default: a `classes` table scoped to one school, with a school-defined name and an active flag. Naming stays entirely school-controlled. **Capacity limits, age rules and prerequisites are not enforced** — matching the reference systems and avoiding invented rules.

### 5.4 Corrections are audited; second approval is off by default

Every correction writes an audit event (mandatory, section 4). Whether a correction needs approval by a second person is a **per-school configurable policy**, defaulting to **off**, so the workflow is not obstructed. The finding gives no basis to mandate an approval chain.

### 5.5 One current class placement per learner

A learner has at most one current class placement. The data model must accommodate future academic-year history and transfers without redesign — every placement change is recorded with its timestamp and, where applicable, a transfer or end date (section 9, E1).

## 6. Provisional School-Specific Policy

`[PROVISIONAL]` — unverified. Configurable. Revisable without a schema change. (The **initial role set** in 5.1 is approved by D-021; the approval-policy and permission-detail rows below remain provisional.)

| Question | Status | Default while unresolved |
|---|---|---|
| Do headteacher, registrar and teacher exist as distinct roles? | **Resolved for the initial set (D-021)** — Teacher exists; headteacher, registrar and parent/guardian are not in the initial set | Teacher is a distinct role; other school-specific roles are added later by configuration (5.1) |
| Which roles may create, view, correct or approve enrolments? | Unverified | School Administrator has full enrolment management; Teacher and Student have no enrolment permissions by default (granted only through the catalogue when an approved feature requires it) |
| May teachers view enrolments for their assigned classes? | Unverified | No teacher permission by default; seeded through the catalogue when an approved feature requires it |
| Do corrections need a second approval? | Unverified — no validated process found | Off, configurable per school (5.4) |
| Are classes grouped by stream, year or level? | Unverified | Single school-scoped class list (5.3) |
| Is class placement ever year-scoped? | Unverified | Not in v1. See section 9, E1 |
| Who may withdraw a learner? | Unverified | School Administrator only |
| Who may initiate student account activation and assisted resets? | Unverified | School Administrator |

## 7. Enrolment Field and Identifier Model (Approved)

Approved by the project owner on 2026-10-11 and recorded as D-019.

### 7.1 Registration fields

The school administrator registers the student. **Students do not register themselves.**

| Field | Requirement | Notes |
|---|---|---|
| First name | **Required** | |
| Last name | **Required** | |
| Internal student ID | **Required**, system-generated | Stable key linking database records. Never user-entered |
| School registration number | **Required**, unique within the school | Human-readable administrative identifier. **Not** globally unique |
| Gender | **Required** | Controlled list. Initial values: Male, Female, Other |
| Date of birth | **Required** | Personal data about a child |
| Residential address | **Required** | Free text |
| Parent/guardian phone | **Required** | Contact detail. Not a verified identity factor |
| Class placement | **Required** | Selected from the school's configured class records (5.3). Not free text |
| Parent/guardian email | **Optional** | Never required for registration or portal access |
| Enrolment status | **Required**, defaults `active` | Supports 5.2 |

**No personal email address is required of a student** for registration or portal access. Do not require a personal Gmail or any other personal email account.

Fields deliberately **not** collected: medical, disability, biometric and financial details. `docs/SECURITY_AND_PRIVACY.md` 4 prohibits collecting these without a defined feature and valid basis.

### 7.2 Identifiers

Separate identifiers, with different purposes. None is a password and none proves account ownership.

| Identifier | Purpose | Uniqueness | Exposure |
|---|---|---|---|
| Internal student ID | Stable key used to link database records; also the base of the internal Supabase account identifier (8.4) | Unique within the platform | Not user-facing |
| School registration number | Readable identifier used in school administration | Unique **within the school** only | Visible to authorised school users |
| School code | Tenant reference used with the username at student sign-in (8.4) | Unique within the platform | Visible to the school's users; not a secret |
| Login username | Student sign-in name | Unique **within the school** — composite `(school_id, username)` (see 7.3) | Visible to the student |
| Internal account identifier | Supabase Auth identity for the student account (8.4) | Unique within the platform | Never shown to any user; server-only |

Knowing an internal ID, a registration number, a school code, or a username grants **no** access. None of them may be used as proof of identity for password recovery. The internal account identifier is never exposed to any user at all.

### 7.3 Uniqueness and duplicate detection

- **School registration number:** composite unique constraint on `(school_id, registration_number)`. It is not assumed to be globally unique.
- **Username:** generated from the student's name, normalised consistently (case, spacing, and characters), with an automatic suffix when a collision occurs. Usernames must be unique **within their school** (composite `(school_id, username)`), because sign-in takes a school code together with the username (8.4).
- **Learner duplicates:** identify a possible existing learner by matching available identifying fields and surface the candidates to the administrator. Merging or overwriting is **never automatic**.

## 8. Student Account and Portal Access (Approved)

Approved by the project owner on 2026-10-11 and recorded as D-019.

Students need individual accounts to access their own dashboard and permitted school records — for example, published report cards when that functionality is implemented. The wider portal is **not** part of the first implementation slice (section 10).

### 8.1 Account model

- Registration and portal access are **separate**. A school can register a student before releasing portal access.
- Portal access is a **state**, distinct from enrolment status: approximately `none` → `activation pending` → `active`, with `suspended` or `revoked` available. The exact state names are a schema decision.
- One account resolves to exactly one school (D-017), consistent with the membership model.
- Only an authorised administrator initiates registration and activation.

### 8.2 Activation workflow

1. An authorised administrator registers the student.
2. The system generates the student's identifiers and login username (7.3). The **school code** (7.2) is assigned once when the school is created, not per student.
3. Portal access remains separately controlled from enrolment status.
4. When the school is ready, an authorised administrator initiates account activation.
5. The system generates a **single-use activation credential** and presents the activation instructions to the administrator.
6. The administrator copies or shares the instructions through an available channel such as WhatsApp or SMS. **No messaging integration exists or is assumed** (D-014 is open).
7. The student opens the activation page, enters the activation code if required, chooses a password, confirms it, and activates the account.
8. The system confirms success and directs the student to the login page.
9. The student signs in with the school code, username and password.

Requirements for the activation credential:

- Cryptographically random and single-use.
- Stored only as a hash; never logged or displayed after issue.
- Expiry configurable, with **72 hours** as the initial default.
- Revocable before use, and invalidated immediately after use or expiry.
- Re-issue possible by an authorised administrator, which invalidates the previous credential.

The administrator must **never** see or retrieve the student's chosen password. The administrator may assist the student in person through a private activation flow.

### 8.3 Password change and recovery

- An authenticated student can change their own password.
- Student-initiated recovery is supported **only where a suitable verified recovery method exists**. With no verified student email or phone, self-service recovery may be unavailable; this is an accepted limitation, not a defect.
- **Administrator-assisted recovery** is available for students who cannot recover independently: after an appropriate identity-verification procedure, an authorised administrator can initiate a reset that issues a **one-time reset credential** which expires and cannot be reused.
- One-time reset credentials follow the same rules as activation credentials (8.2).
- Administrators must never see existing passwords or choose a student's permanent password.
- **Date of birth, student name, or other personal information alone is never sufficient** to authorise password recovery.
- Administrator-assisted resets and account-security events are audited.

### 8.4 Authentication approach (Approved — D-020)

Supabase Auth does not support username/password sign-in natively; its identity types are email, phone, OAuth and SAML. The approved approach is **server-mediated school-code + username sign-in**, with Supabase Auth still performing password verification and session issuance. Full reasoning, evidence and alternatives are in `docs/DECISIONS.md` D-020.

The mechanism:

- **Sign-in input:** school code, username, password. The student never sees or enters the internal account identifier.
- **Resolution:** a trusted server route resolves `(school code, username)` to the internal account identifier from a protected, RLS-restricted mapping table, then calls Supabase `auth.signInWithPassword`. The publishable key is used; the server-only secret key never reaches the browser.
- **Internal account identifier:** Supabase requires an email- or phone-shaped identity for a permanent account, so each student account is stored against an opaque identifier derived from the platform-generated internal student ID. It lives in the RFC 2606 reserved `.invalid` domain (for example `<internal-student-id>@students.invalid`), which can never be registered or delivered to. It is **never shown to any user as an email address**, never used for delivery, and email flows (confirmation, magic link, recovery) are disabled for these accounts.
- **Password:** passed only to Supabase Auth. The platform never stores, logs, or displays it. This is not a custom password-storage mechanism.
- **Namespace protection:** a Supabase `Before User Created` Auth Hook must reject any sign-up that did not come through the trusted server path, so the reserved namespace cannot be populated by other means.
- **Activation and recovery consistency:** activation (8.2) and administrator-assisted recovery (8.3) issue one-time credentials that let the **student** choose a new password through a server route. The server uses the server-only secret key to apply the student-chosen password via the Supabase admin API only after the one-time credential is verified; it never generates, sees, or stores the permanent password itself.
- **Enumeration and rate limiting:** the resolution path must be rate-limited and must not reveal whether a school code, username or account exists.

This does not block Phase 1. Staff authentication is ordinary email/password and is unaffected, and the student portal is not part of the first implementation slice.

## 9. Essential Unresolved Decisions

Only decisions that materially affect the enrolment workflow or its database structure.

| ID | Decision | Status | Effect | Blocks? |
|---|---|---|---|---|
| E1 | Is class placement academic-year scoped? | **Open** — not year-scoped in v1; store placement timestamps and support end/transfer dates | Determines whether a placement needs an academic-year foreign key. Adding it later is a migration, not a redesign | No |
| E2 | Exact required field set | **Resolved** — D-019, section 7.1 | Determines table columns | No |
| E3 | One class per learner, or many? | **Resolved as a default** — one current placement, history retained (5.5) | Shape of the placement table | No |
| E4 | Does correction need second approval? | **Resolved as a default** — off by default, configurable per school (5.4). Audit is mandatory either way | Whether an approval queue is needed | No |
| E5 | Final school role set | **Resolved 2026-10-12** — D-021: Platform Owner, School Administrator, Teacher, Student; permissions as data (5.1) | Seed data and the permission catalogue, not the schema | No |
| E6 | Student portal authentication approach | **Resolved** — D-020, school-code + username over an internal non-deliverable identifier (8.4) | Portal sign-in implementation. Not in the first slice | No |

### What can safely wait

- The permission **catalogue content** per feature — configuration, not schema. (The final role names are settled: D-021.)
- Approval workflow — configurable, default off.
- Stream, level or year structures — add as configuration later.
- Student portal authentication **implementation** — the approach is settled by D-020, but the code is needed only when the portal slice starts.
- Grading, fees, attendance, reporting, notifications — out of scope entirely.

## 10. Out of Scope

This document covers student enrolment, class placement, and the account model that gives a student access to their own records. It does **not** cover, and must not be extended to:

- Attendance
- Assessment, grading or results
- Fees or payments
- Reporting and report-card generation
- Parent portals
- Notifications and messaging integrations
- Any other module

The student **portal account model** in section 8 is approved for design coherence, but portal screens, dashboards, report cards and notifications are not part of the first implementation slice. Extending this document to those features requires an explicit scope decision.

## 11. Next Steps

1. Sections 4, 5, 7 and 8 are approved; implement them as the enrolment slice is built.
2. The initial role set in section 6 is approved (D-021); keep the approval-policy and permission-detail rows provisional until school responsibilities are actually validated.
3. Implement the D-020 approach (8.4) when the portal slice starts, and verify it against a real Supabase project first.
4. Resolve E1 (year-scoped placement) before the placement schema is finalised for production.
