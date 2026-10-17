# Architecture and Product Decisions

**Project:** School Management Platform\
**Document status:** Living decision record\
**Version:** 1.4

## 1. Purpose

This document records important product, architecture, security, and operational decisions for the school management platform.

Its purpose is to prevent the implementation agent from confusing confirmed requirements with recommendations or unresolved questions.

Update this document when a significant decision is approved or changed. Do not silently replace an established decision with a different approach.

## 2. Decision Status

Use these labels:

- **Confirmed:** explicitly agreed by the project owner.
- **Proposed:** recommended but awaiting approval or validation.
- **Open:** a decision that must still be made.
- **Superseded:** a previous decision replaced by a later approved decision.

## 3. Confirmed Decisions

### D-001: Initial target market

**Status:** Confirmed

The platform is intended initially for community schools in Ghana.

Design the product around practical school operations, affordability, usability, and local operating conditions. Do not assume every school follows identical administrative, academic, or financial procedures.

### D-002: Shared codebase

**Status:** Confirmed

Use one primary application codebase and one GitHub repository initially.

Avoid separate codebases for individual schools unless a future decision establishes a specific need.

### D-003: Shared initial application deployment

**Status:** Confirmed

Use one shared application deployment initially, subject to validation of hosting capabilities and operational requirements.

### D-004: Shared initial production database project

**Status:** Confirmed

The intended initial architecture uses one shared Supabase production project, with strict database-level authorization and logical school isolation.

This does not authorize unrestricted shared access. Every school must remain isolated from other schools' data.

### D-005: Independent school workspaces

**Status:** Confirmed

Each school must have its own logical workspace, school-specific users and records, and independently configurable settings and enabled modules.

A user's access to one school must not automatically grant access to another school.

### D-006: Future dedicated infrastructure

**Status:** Confirmed

The architecture must leave a reasonable path for moving an individual school to dedicated infrastructure if justified by security, contractual, regulatory, performance, or operational requirements.

Do not build a complex multi-deployment control plane prematurely.

### D-007: Web-first product

**Status:** Confirmed

Build the initial product as a web application that works on desktop and mobile browsers.

PWA capabilities may be introduced where useful and supported by the chosen architecture.

### D-008: Low-connectivity considerations

**Status:** Confirmed

The interface and workflows must account for unreliable or slow connections.

Offline functionality must be implemented only for explicitly selected workflows with defined synchronization, conflict, security, and recovery behavior. Do not claim complete offline operation by default.

### D-009: Incremental implementation

**Status:** Confirmed

Establish a secure foundation and validate one complete end-to-end workflow before expanding broadly across modules.

Do not attempt to implement the entire platform in one large development operation.

### D-010: Security and privacy

**Status:** Confirmed

Tenant isolation, server-side authorization, database RLS, safe secret handling, and protection of personal learner information are foundational requirements.

Do not defer these requirements until after the main features have been built.

## 4. Proposed Technical Direction

The following is a proposed stack, not an unconditional commitment.

### D-011: Application framework

**Status:** Confirmed

Next.js with TypeScript.

Validated 2026-10-11 against the confirmed Supabase direction (D-012, D-015). The installed and recorded framework version is **Next.js 16.4.0**, with React 19.3.0 and TypeScript 5.9.x, on Node.js 24.16.0. Next.js 16.3.8 was Active LTS at validation time; 16.4.0 is the version the project actually scaffolds on, and the project owner confirmed on 2026-10-11 that 16.4.0 is retained rather than pinned down to the LTS version, unless a concrete compatibility failure requires otherwise. Next.js 16 requires Node.js 20.9 or later and TypeScript 5.1 or later. Supabase maintains first-party App Router support through `@supabase/ssr`. No concrete blocker was found in the framework and language pairing. The integration risks identified during validation are recorded in `docs/PHASE0_RISK_REGISTER.md`.

Subject to the existing documented requirements and compatibility constraints in `docs/SYSTEM_ARCHITECTURE.md`.

### D-012: Database and authentication

**Status:** Confirmed

Supabase PostgreSQL and Supabase Auth, with Supabase Storage if required.

Use PostgreSQL constraints and RLS to enforce appropriate data-access restrictions. Authentication alone is not sufficient to establish school-level permissions.

See D-015 for the evaluated alternatives, the trade-offs accepted, and the conditions that would justify revisiting this choice.

### D-013: Hosting

- **Status:** Confirmed for development; **Proposed** for production.
- **Date:** 2026-10-12 (development arrangement effective 2026-10-12; the underlying dev project was recorded in `docs/PHASE0_RISK_REGISTER.md` 5)
- **Context:** "Hosting" was previously recorded as Open with no provider assumed (see `docs/DATABASE_DOCUMENTATION.md` 11 for the backup/recovery part of the same question). Two distinct questions were being conflated: where the **application** runs, and which backend services it uses. The backend is settled (D-015), and the application runs as one shared deployment (D-003), so what remained open is the application-hosting arrangement — and it differs between development and production.
- **Decision:**
  - **Development:** continue using the existing local Next.js setup and the existing Supabase non-production project `school-management-dev` (Free plan). No hosting change is required or authorised for development.
  - **Production (proposed):** **Vercel** is recorded as the proposed application-hosting option, subject to compatibility and cost validation. It is a **Proposed** option, not a confirmed provider; a different provider may be selected after validation.
  - **Production (bounded):** production must use a **separately configured environment** from development, with backup, security, privacy and cost requirements verified before deployment. The Supabase production plan and its actual limits must be reviewed and approved before any real school is onboarded (`docs/PRD.md` 12).
- **Reasoning:** The application is Next.js on Node hosted as one shared deployment, and the backend remains managed Supabase. Vercel is the framework's own first-class Next.js hosting, which keeps the deployment surface minimal for a solo operator. It remains a proposal because cost, compatibility with the specific Next.js features used, and data-residency considerations are not yet verified and must not be assumed.
- **Alternatives:** *Keeping development hosting as production hosting* — rejected; a dev Free-plan environment must not be used to onboard a real school (`docs/PRD.md` 12). *Self-hosted Node in production* — viable but adds operating burden and was not chosen as the initial proposal. Any provider remains open subject to the same validation.
- **Consequences:** No deployment, upgrade, or paid-service activation is performed. Until validation completes, the production hosting plan remains a production-readiness item; development stays zero-cost on the Free plan (D-015). Vercel compatibility and cost validation, plus backup/security/privacy verification of the production environment, are explicit production-readiness gates.
- **Dependencies:** Compatibility and cost validation of the proposed provider; production plan and actual-limit review; the production readiness checks in `docs/DEPLOYMENT_AND_OPERATIONS.md` 3 and `docs/PRD.md` 12.
- **Approval:** Project owner, 2026-10-12.

### D-014: Background jobs and integrations

**Status:** Open

Choose background processing, email, payment, notification, and other external services only when an approved feature requires them.

Evaluate costs, credentials, reliability, security, and alternatives before introducing paid dependencies.

### D-015: Backend platform selection

- **Status:** Confirmed
- **Date:** 2026-10-11
- **Context:** D-012 was recorded as *Proposed* while `AGENTS.md`, `docs/PRD.md` and `docs/SYSTEM_ARCHITECTURE.md` already described Supabase as settled. That inconsistency had to be resolved before any implementation work. The platform requirements impose binding technical constraints that narrow the viable options.
- **Decision:** Supabase is the selected backend direction. Development starts on the Supabase Free plan. The Free plan is **not** approved as a production configuration; the production plan and actual provider limits must be reviewed and approved before any real school is onboarded.
- **Reasoning:** Three requirements are non-negotiable under the existing documentation and are what decided the outcome. `docs/DATABASE_DOCUMENTATION.md` 4.2 requires database-level enforcement of tenant-consistent relationships, and states that application-level checks alone are insufficient. Section 5.1 requires PostgreSQL Row Level Security on all exposed tenant tables. Section 6 requires exact numeric types rather than floating-point arithmetic for currency. Supabase satisfies all three without amending any existing document, and additionally supplies authentication, multi-factor authentication, private storage with RLS, auth audit logs and backups as one managed unit. This matters because `docs/DEPLOYMENT_AND_OPERATIONS.md` 2 requires a deployment model a solo developer can operate reliably.
- **Alternatives:** *Firebase* was rejected. Cloud Firestore offers no PostgreSQL, therefore no RLS and no composite foreign keys, and its only numeric types are 64-bit IEEE 754 floating point and 64-bit signed integer, with no exact decimal type. Using it would require weakening `docs/DATABASE_DOCUMENTATION.md` 4.2 and 6. Firestore does have the strongest built-in offline persistence of the three options, which remains worth reconsidering only if offline capability is ever formally approved as a dominant requirement under D-008. *Neon* was rejected for the initial phase. It is genuine PostgreSQL with RLS, composite foreign keys and exact numerics, and is cheaper on compute alone, but it supplies no private object storage, its managed authentication currently lacks multi-factor support and has only partial organization support, and it requires separately sourcing storage, authentication and email delivery. For a single-developer operation those unbudgeted components outweigh the compute saving. Neon remains a viable dedicated-infrastructure option under D-006.
- **Consequences:** The project accepts that provider capability is verified only for the specific features used, and must be re-verified before production use. The service-role credential that bypasses RLS remains the single highest operational risk and continues to be governed by `docs/DATABASE_DOCUMENTATION.md` 5.2 and `docs/SYSTEM_ARCHITECTURE.md` 5; that risk is inherent to any privileged database credential and is not removed by choosing a different provider. Cost is not yet bounded: point-in-time recovery is an additional paid add-on, and recovery objectives are recorded only as proposed targets pending verification (D-022). Migration away from Supabase remains feasible because the database is PostgreSQL and exports are portable.
- **Dependencies:** Before production, confirm the production plan and its actual limits, verify the proposed RPO/RTO targets (D-022) through backup capability and a restoration test in a non-production environment, verify the associated costs, and confirm data residency and processor terms against applicable Ghanaian requirements. See `docs/SECURITY_AND_PRIVACY.md` 5.
- **Approval:** Project owner.

### D-016: Accessibility target

- **Status:** Confirmed
- **Date:** 2026-10-11
- **Context:** `docs/UI_UX_DOCUMENTATION.md` 11 stated WCAG 2.2 Level AA as a target "where practical", while `AGENTS.md` 9 referenced it "where specified", and `docs/PRD.md` 9 named no standard at all. Because `AGENTS.md` 2 makes the PRD the source of truth, no binding accessibility target existed.
- **Decision:** WCAG 2.2 Level AA is the accessibility target for the product and is stated consistently in `docs/PRD.md`, `docs/UI_UX_DOCUMENTATION.md` and `docs/FEATURE_SPECIFICATIONS.md`.
- **Reasoning:** `docs/PRD.md` 9 already required keyboard support, readable text, sufficient contrast and accessible form errors. Naming a standard makes those existing requirements testable rather than subjective.
- **Alternatives:** Keeping an unstated or "where practical" target was rejected because it cannot be verified or audited.
- **Consequences:** Exceptions remain possible but must be recorded with their justification and the affected devices or screen sizes, per `docs/FEATURE_SPECIFICATIONS.md` 13.1. An exception is a documented, justified deviation and does not lower the general target.
- **Dependencies:** None.
- **Approval:** Project owner.

### D-017: Multi-school membership in the first release

- **Status:** Confirmed
- **Date:** 2026-10-11
- **Context:** `docs/DECISIONS.md` listed "can a person belong to multiple schools?" as an open question, yet `AGENTS.md` 4 stated an unconditional requirement to handle school switching, and `docs/UI_UX_DOCUMENTATION.md` 4.1 and `docs/SYSTEM_ARCHITECTURE.md` 6 specified behaviour for multi-school membership.
- **Decision:** A single user account is **not** a member of more than one school in the first release. Multi-tenant support, meaning many independent schools within one shared deployment, is unchanged and remains confirmed under D-004 and D-005.
- **Reasoning:** The MVP workflow has not yet been selected. Adding school switching before it is chosen would build a navigation and cache-invalidation surface with no validated user requirement, and would create a cross-school data-leakage risk at exactly the point where the core isolation model is least proven.
- **Alternatives:** Implementing multi-school membership in the first release was rejected as unjustified scope. Restricting the platform to a single school was rejected as incompatible with D-004 and D-005.
- **Consequences:** School switching, active-school context validation and cross-school cache invalidation remain **required** architecture, so that multi-school membership can be added later without redesign, but they are not implemented behaviour in the first release. School membership must still be modelled explicitly, and every protected operation continues to verify membership server-side against exactly one resolved school.
- **Dependencies:** Revisit when an approved workflow or a participating school requires it.
- **Approval:** Project owner.

### D-018: First end-to-end workflow

- **Status:** Confirmed
- **Date:** 2026-10-11
- **Context:** `docs/PRD.md` 7 required the first workflow to be chosen before implementation and explicitly forbade the agent from assuming one. Phase 0 assessed five candidates against the requirement that the slice exercise the whole architecture, including tenant isolation.
- **Decision:** **Student enrolment, including class placement**, is the first end-to-end workflow. Scope is limited to creating and managing a student's enrolment within an authorized school and assigning the student to a class.
- **Reasoning:** It is the only candidate that is simultaneously valuable, bounded, and capable of proving the tenant-isolation model end to end. It requires authentication, school membership resolution, a permission check, a database write, RLS on both insert and select, and a tenant-consistent relationship between a learner and a class — precisely the constraint set that disqualified other backends in D-015. It is also a prerequisite for attendance, assessment and reporting. Assessment records were ruled out because `docs/PRD.md` 11 lists grading differences between schools as unvalidated, so building them now would require inventing rules. Academic reporting depends on assessment records and cannot lead.
- **Alternatives:** *Class assignment alone* cannot stand alone because it creates no learner record. *Attendance* depends on enrolment existing and is the workflow most likely to require offline capture, which is a materially larger scope. *Assessment records* are blocked by unvalidated grading rules. *Academic reporting* depends on assessment records.
- **Consequences:** Assessments, grading, fees and unrelated modules are explicitly excluded from this slice. Enrolment must satisfy the tenant-consistent relationship requirement in `docs/DATABASE_DOCUMENTATION.md` 4.2 and is subject to data minimisation under `docs/SECURITY_AND_PRIVACY.md` 4. Which school roles may enrol and who may approve corrections remains open and must be settled before authorization is implemented.
- **Dependencies:** Role and permission definitions for the first release. Confirmation that the fields actually required at enrolment match the minimum necessary.
- **Approval:** Project owner.

### D-019: Student registration, identifiers, and portal account access

- **Status:** Confirmed
- **Date:** 2026-10-11
- **Context:** D-018 selected student enrolment including class placement as the first workflow and left open which fields are genuinely required and how a student would later reach their own records. A reference-system investigation of two existing school systems (YAW Academy and Tina's Little Angels Preparatory School) listed ten enrolment fields but found no universal field policy, no shared multi-tenant architecture, and no validated approval process. `docs/SECURITY_AND_PRIVACY.md` 4 requires data minimisation, and `docs/PRD.md` 8 treats parent and student portals as non-goals "before the core school workflows are validated". The project owner then approved a specific registration and account model.
- **Decision:** The owner approved the registration field model, the two-identifier model, the administrator-led portal activation model, and the password and recovery policy recorded in full in `docs/ENROLMENT_PERMISSION_MODEL.md` 7 and 8. In summary:
  - Registration is performed by an authorised school administrator. Students do not self-register.
  - Required fields: first name, last name, system-generated internal student ID, school registration number, gender (controlled list: Male, Female, Other), date of birth, residential address, parent/guardian phone, and class placement selected from the school's configured class records. Parent/guardian email is optional.
  - **No personal email address is required** of a student for registration or portal access.
  - The internal student ID and the school registration number are separate. Neither is a password or sufficient proof of account ownership.
  - The school registration number is unique **within its school**, not globally. Login usernames are unique within the sign-in namespace.
  - Portal access is a **separate state** from enrolment status. A student may be registered before portal access is released.
  - Activation uses a single-use, hashed, expiring credential (initial default 72 hours), presented to the administrator for manual sharing. No messaging integration exists or is assumed (D-014).
  - Administrators never see or choose a student's password. Recovery is student-initiated where a verified method exists, otherwise administrator-assisted, and is audited.
- **Reasoning:** The owner's requirement is to register students without requiring them to own email addresses. This is realistic for community schools and reduces the personal data collected about children. Separating the internal ID from the administrative registration number keeps the database key stable and opaque while giving schools a readable reference. Separating portal access from enrolment lets a school record a student immediately and defer the account decision. Administrator-led activation matches the finding that administrators create accounts and avoids building an unvalidated self-service flow.
- **Alternatives:** *Collecting all ten reference-system fields including email by default* was rejected as contrary to data minimisation and unnecessary for enrolment. *Free-text class names* were already rejected in the enrolment model on data-integrity grounds. *Student self-registration* was rejected: it would allow unverified records and does not match observed practice. *A single identifier used for both database linkage and school administration* was rejected because the two have different uniqueness scopes and different exposure. *Global uniqueness for the school registration number* was rejected because schools assign their own numbers independently and collisions across schools are expected and harmless.
- **Consequences:** The enrolment schema carries required columns for the fields above, a composite unique constraint on `(school_id, registration_number)`, and a username unique within the school (see D-020). Portal access state is modelled separately from enrolment status. The first implementation slice still excludes portal screens; only the model is fixed. Permanent deletion remains subject to an approved retention policy before production; the interim framework in D-023 applies until then (`docs/ENROLMENT_PERMISSION_MODEL.md` 5.2).
- **Dependencies:** The student portal authentication approach, which Supabase Auth cannot satisfy natively — resolved by D-020. The class and placement model in `docs/ENROLMENT_PERMISSION_MODEL.md` 5.3 and E1.
- **Approval:** Project owner.

### D-020: Student portal authentication approach

- **Status:** Confirmed
- **Date:** 2026-10-11 (approved 2026-10-11)
- **Context:** D-019 requires students to sign in with a username and password without owning, or being required to provide, a personal email address or phone number. The project owner directed that this be evaluated against Supabase Auth before implementation, without inventing real email addresses or building a custom authentication system.
- **Evidence (verified 2026-10-11 against vendor documentation):**
  - Supabase Auth identity types are **email, phone, OAuth and SAML**. Password sign-in requires either an email address or a phone number. There is no username identity, and Supabase has stated it does not intend to add username/password as a first-class sign-in mechanism.
  - *Permanent* users — those able to sign back in after signing out — are tied to a piece of personally identifiable information: an email, a phone number, or a third-party identity. *Anonymous* users cannot sign back in after sign-out and therefore cannot serve as student accounts.
  - The extension points available without a custom auth system are **Auth Hooks** (Postgres functions; `Before User Created` and `Custom Access Token` are available on Free and Pro) and **third-party authentication** (Clerk, Auth0, Firebase Auth, Cognito, WorkOS), the latter being a separate paid dependency outside D-014.
  - Phone-based sign-in requires an SMS provider, a paid external dependency; students in the target age group may not hold a phone.
- **Conflict resolved:** The requirements "no email required from students", "no invented real email addresses", "no custom authentication system" and "zero cost" cannot all hold simultaneously through Supabase Auth, because it has no username identity and its only non-third-party permanent identity options are email or phone. The owner approved bending the "no email-shaped value at all" constraint in a controlled way rather than the others: Supabase receives an **internal, non-deliverable, non-personal account identifier that is never a real address and is never shown as one**, while the student authenticates with a **school code and username** and no email or phone of their own.
- **Decision (approved by the project owner 2026-10-11):** Use **server-mediated username sign-in** over an opaque, platform-controlled, non-deliverable internal account identifier. Supabase Auth remains the password verifier and the session issuer; no custom password system is built.
  - **Sign-in credential:** the student signs in with **school code + username + password**. The student never types or sees the internal identifier.
  - **Internal account identifier:** because Supabase requires an email- or phone-shaped identity for a permanent account, each student account is stored against an internal identifier that is email-shaped only for that reason. The identifier:
    - is generated server-side and is **opaque** — derived from the platform-generated internal student ID (a random, non-sequential value), never from the student's name, registration number or username, so it cannot be guessed or enumerated and leaks no personal data;
    - lives entirely in the RFC 2606 reserved `.invalid` domain (for example `<internal-student-id>@students.invalid`), a namespace that can never be registered, delegated or delivered to; the exact namespace must pass Supabase's email-format validation and is verified against the real project before use;
    - is **never presented to any user as an email address**, is never used for email delivery, and email flows (confirmation, magic link, recovery) are disabled for these accounts;
    - is stored and used only in trusted server code.
  - **Resolution path:** a trusted server route receives the school code, username and password; resolves the `(school code, username)` pair to the internal account identifier from a protected, RLS-restricted mapping table; then calls Supabase `auth.signInWithPassword` with the identifier and password; and establishes the session cookie through `@supabase/ssr`. The publishable key is used for sign-in; the server-only secret key never reaches the browser.
  - **Password handling:** the password is passed only to Supabase Auth. The platform never stores, logs, or displays it. This is **not** a custom password-storage mechanism.
  - **Uniqueness refinement:** because sign-in now supplies a school code, the **username is unique within its school** (`(school_id, username)`), not across the whole platform. The school code is globally unique and is a readable tenant reference, not a secret and not proof of identity. This refines the "unique within the sign-in namespace" wording in D-019; the namespace is the school.
- **Reasoning:** This is the only option that keeps Supabase Auth as the identity provider, keeps student accounts recoverable, requires no email or phone from the student, and adds no paid dependency. All username logic is confined to trusted server code and one protected table — a small, auditable surface — while password verification, hashing, and session issuance remain with Supabase Auth.
- **Alternatives:** *Supabase phone authentication* — requires a paid SMS provider (D-014) and assumes students hold phone numbers; rejected for the target age group. *Third-party identity provider* — paid, adds a second identity system and operational surface with no driving requirement; rejected. *Custom authentication in the application* — rejected outright by `docs/SECURITY_AND_PRIVACY.md` 6 and `AGENTS.md` 5. *Requiring a personal email after all* — rejected by the owner's requirement and contrary to data minimisation. *Using a real, deliverable platform mailbox per student* — rejected because it invites delivery, creates a real inbox, and would leak or require operating mail. *Deferring the student portal entirely* — possible but not required; the portal remains outside the first implementation slice regardless, so this decision is implemented only when the portal slice begins.
- **Consequences:** The internal account identifier and the school code are implementation details that must be documented as such, so no later contributor treats the identifier as a real mailbox or enables email delivery to it. Username resolution becomes a security-sensitive server path that must be rate-limited, must not reveal whether an account exists, and must be audited on failure patterns. A Supabase `Before User Created` Auth Hook can reject any sign-up that is not created by the trusted server path, preventing the reserved namespace from being populated by other means. Tenant isolation, RLS and the staff authentication model are unaffected. Because a permanent Supabase account is still created, the identifier is a piece of account metadata; it contains no personal data and is not linked to the student in any public surface.
- **Verified 2026-10-12 against `school-management-dev`:** the reserved `students.invalid` namespace is accepted by GoTrue for server-provisioned accounts; school-code + username + password sign-in works end-to-end; public sign-up is disabled and the `Before User Created` Auth Hook was verified to refuse any sign-up the platform server did not stamp (the hook runs on the sign-up path only — the admin API is protected by the server-only secret key); the resolution path is rate-limited and returns uniform failures; the project uses asymmetric signing keys, so `getClaims()` takes the local JWKS path. Full record: `docs/PHASE0_RISK_REGISTER.md` 10.4.
- **Dependencies:** A Supabase project to prove the flow (`signInWithPassword` against a server-created account, session cookies via `@supabase/ssr`, email flows disabled, reserved namespace accepted by the email validator, and a `Before User Created` hook that only permits the trusted server path). The owner approved the identifier trade-off on 2026-10-11.
- **Approval:** Project owner, 2026-10-11.

### D-021: Initial platform roles and their boundaries

- **Status:** Confirmed
- **Date:** 2026-10-12
- **Context:** "Which school roles are required initially" and "final school role set" (E5) were open in `docs/PHASE0_RISK_REGISTER.md` 5 and `docs/ENROLMENT_PERMISSION_MODEL.md` 9, with an interim default of *school administrator + school staff* in `docs/ENROLMENT_PERMISSION_MODEL.md` 5.1. Enrolment authorization (D-018) and every staff-facing feature depend on knowing which roles exist and what their boundaries are. D-019 already set the student account model, so the student role's existence was never genuinely in question; the open part was the full initial set and each role's scope.
- **Decision:** The initial role set is exactly four roles: **Platform Owner, School Administrator, Teacher, and Student**. Parent/Guardian access is **deferred** and is not part of the initial set. Roles remain **labels**; each role's authority comes from the permission catalogue stored as data (`role_permissions`), never from hard-coded role names. Initial scope and school boundary per role:
  - **Platform Owner** — platform-level, **cross-school** administrative capability, not bound to one school. Capabilities are a narrow, enumerated set (for example creating and configuring schools and platform settings). Platform Owner access to student or school records is **not** unrestricted: any such access requires explicit, scoped authorization for the specific operation and is **audited**; the role label alone never bypasses school isolation or RLS.
  - **School Administrator** — **exactly one school** (its `school_members` row). Manages that school's own members, enrolment records, class configuration, portal activation/recovery, and settings. No cross-school capability.
  - **Teacher** — **exactly one school**. School-scoped teaching role. By default the teacher is assigned **no** permissions; each approved feature seeds its own teacher permission through the catalogue (for example, view of own-class rosters).
  - **Student** — **exactly one school** (the account's school, D-017). Access only to the student's **own** records (own profile, own portal data, own report cards when implemented). A student session never has staff-level permissions.
- **Reasoning:** These four roles match how the first workflows are actually performed — schools administer, teachers teach, students access their own records — while keeping the Platform Owner narrow, explicitly authorized, and audited, and deferring a parent account until a validated requirement (and a verified contact/verification method) exists. Storing permissions as data keeps later role additions a configuration change, consistent with the reference finding that no universal staff-role structure exists (D-019).
- **Alternatives:** *Keeping the two-role interim (school administrator + school staff) as final* — rejected by the owner; Teacher and Student are already required by the approved workflows. *Adding headteacher, registrar or parent/guardian now* — rejected: their responsibilities are unvalidated and Parent/Guardian access is explicitly deferred.
- **Consequences:** The interim *school administrator + school staff* default in `docs/ENROLMENT_PERMISSION_MODEL.md` 5.1 is superseded (E5 resolved). The permission catalogue must not grant Platform Owner broad student-record access by default. The four role labels may be referenced by name in authorization code, but permissions stay data-driven; the catalogue content for each feature is still decided when the feature is implemented. Platform Owner operations must be auditable end to end.
- **Dependencies:** The staff authentication model and enrolment authorization (Phase 1) implement against this set; the permission catalogue is seeded feature by feature.
- **Approval:** Project owner, 2026-10-12.

### D-022: Proposed initial production recovery targets

- **Status:** Confirmed as proposed targets; **not verified guarantees**.
- **Date:** 2026-10-12
- **Context:** `docs/PRD.md` 11 and 12, `docs/DATABASE_DOCUMENTATION.md` 11 and `docs/DEPLOYMENT_AND_OPERATIONS.md` 9 required recovery objectives to be agreed and verified before production, and none had been agreed. D-015 also noted cost is not bounded for point-in-time recovery.
- **Decision:** Record **proposed initial production targets** of **RPO 24 hours** and **RTO 24 hours**. These are planning targets, not verified guarantees, and they do not become commitments until the following **mandatory production-readiness tasks** are completed in a non-production environment:
  - verify the selected plan's actual **backup capability**, including whether point-in-time recovery is available and affordable (`docs/DATABASE_DOCUMENTATION.md` 11);
  - perform a **restoration test** and verify the plan can actually meet the D-022 targets;
  - verify the **cost** of the production plan and any backup/recovery add-ons.
- **Reasoning:** A 24-hour recovery profile is a deliberately modest starting point for the first release — it forces a documented backup and restoration discipline without inventing an aggressive objective the Free-plan-based cost model has not been verified to support. It is a target the owner can tighten later once real costs are known.
- **Alternatives:** *Recording no target* — rejected; it blocks production planning and provider selection. *Aggressive targets (for example RPO in minutes via point-in-time recovery)* — rejected for now: unverified cost and not assumed.
- **Consequences:** Development remains non-production and uses test data only; these targets apply to production readiness. Until verified, RPO/RTO must not be represented as met. Backup capability, restoration testing and cost verification are tracked as open production-readiness tasks in `docs/PHASE0_RISK_REGISTER.md` 5.
- **Dependencies:** Production plan and actual-limit review, and the backup/restoration/cost verification above, per `docs/PRD.md` 12.
- **Approval:** Project owner, 2026-10-12.

### D-023: Interim learner-record retention framework

- **Status:** Confirmed (interim framework); **no retention periods are set**.
- **Date:** 2026-10-12
- **Context:** `docs/ENROLMENT_PERMISSION_MODEL.md` 5.2 already restricted permanent deletion and made it subject to "an approved retention and deletion policy before production", and `docs/DATABASE_DOCUMENTATION.md` 9 requires approved retention rules. That policy did not exist; the owner approved an interim framework rather than inventing specific retention periods.
- **Decision:** Adopt the following interim retention framework, in force for development and as the basis for the future production policy:
  - **No permanent deletion of student records merely because a student leaves.** Leaving school is recorded by enrolment state, never by deletion.
  - **Distinguish relevant enrolment states.** A learner is `active` or `inactive` (`docs/ENROLMENT_PERMISSION_MODEL.md` 5.2); portal access is a separate state (`docs/ENROLMENT_PERMISSION_MODEL.md` 8.1). Withdrawal is a state change, not a record deletion.
  - **Restrict access to inactive records.** Inactive/withdrawn records are not part of routine operational views; access requires an authorized, scoped purpose and passes normal permission checks. (A student's own read access to their own records is unaffected.)
  - **Audit sensitive actions.** Deactivation, reactivation, and any access to or export of inactive records are audited like other sensitive enrolment actions (`docs/ENROLMENT_PERMISSION_MODEL.md` 4).
  - **No indefinite retention without a documented purpose.** No retention period is invented here; continued retention of any record beyond its current purpose requires a documented purpose, and every period is validated before production rather than assumed.
- **Reasoning:** The reference systems deactivate rather than delete (`docs/ENROLMENT_PERMISSION_MODEL.md` 2), and the existing documentation already restricts deletion. Inventing specific periods (for example "keep records for N years") would fabricate a policy without legal or school input.
- **Alternatives:** *Setting fixed retention periods now* — rejected; no Ghanaian legal analysis or school agreement validates them. *Allowing permanent deletion on leaving* — rejected; it contradicts the reference findings and `docs/DEPLOYMENT_AND_OPERATIONS.md` 14.
- **Consequences:** Ghanaian privacy, child-protection and education-sector legal requirements, and any school-specific contractual obligations, are recorded as **items requiring validation before real-school onboarding**; they are not established compliance. A documented retention schedule and storage-object retention behavior (`docs/SECURITY_AND_PRIVACY.md` 10) still need to be produced and validated. The framework does not authorise indefinite holding: retention beyond a record's purpose must still be justified and periodically reviewed.
- **Dependencies:** Legal validation (Ghana) and school obligations before onboarding; a documented retention schedule remains to be produced; audit-log retention follows the same framework.
- **Approval:** Project owner, 2026-10-12.

### D-024: Staff authentication and invitation approach

- **Status:** Confirmed; the **invitation delivery mechanics are revised by D-025** (2026-10-15). The authentication, role and school-scoping decisions below remain in force.
- **Date:** 2026-10-12
- **Context:** Phase 1 requires staff authentication to work in the intended environment. D-018 requires enrolment roles (staff) to be invited rather than self-registered, D-021 set the staff roles (School Administrator, Teacher), and `docs/ENROLMENT_PERMISSION_MODEL.md` 8.4 already states staff authentication is ordinary email/password, unaffected by the student portal model. The open part was the concrete invitation mechanics and how an invited member becomes active.
- **Decision:** Implement staff authentication and invitation as follows:
  - **Authentication.** Staff sign in with **email + password** directly against Supabase Auth (no school code, no internal identifier), mirroring D-020's separation of identity from authorization. The school is resolved from the caller's membership after Auth verifies the password — never from the request.
  - **Invitation.** An authorized School Administrator (`member.manage` in their own school) invites by email. The server first creates the auth account via the admin API with `email_confirm: false` and the `provisioned_by = 'school-platform'` marker (the same marker the sign-up guard hook requires — `docs/DATABASE_DOCUMENTATION.md` 5 and the 0002 migration), then calls Supabase's built-in invitation endpoint on that existing user so GoTrue issues the **single-use, expiring invite email**. Two steps are required because GoTrue's invite endpoint ignores `app_metadata` (so a directly invited user would fail the guard hook); the two-step form keeps the guard's rule that only the platform server can create accounts, with the marker in the spoof-proof `app_metadata` location. The membership row is created with status `invited` through the caller's authenticated session, so RLS re-checks the permission and the audit trigger records the actor.
  - **Acceptance.** The invited user follows the email link to `/auth/confirm` (token exchange, not a parallel code channel), chooses a password at `/join` (min 8 / max 72 characters, interim policy), and the first **confirmed** sign-in with that password activates the membership (`invited` → `active`) and writes an actor-attributed audit event. Supabase refuses password sign-in for unconfirmed emails, so activation cannot occur before the email link is used.
  - **Denials.** Sign-in fails closed with uniform messages for: no staff membership, revoked/suspended membership, and an anomalous multi-school membership; it never falls through to a partial session.
- **Reasoning:** Uses Supabase's maintained invitation flow (single-use, expiring token) rather than inventing a parallel channel; keeps the audit trail attributed; keeps the school boundary on the server (an invite is always aimed at the caller's own school); satisfies D-018 (staff are invited, never self-registered).
- **Alternatives:** *Administrator-chosen passwords* — rejected (never generate or see staff passwords; consistent with the student model). *Self-registration* — rejected by D-018. *Accepting the marker in `user_metadata` so a one-step invite works* — rejected: `user_metadata` is client-settable on sign-up paths, which would let a future sign-up spoof the marker and weaken the guard.
- **Consequences:** The interim password policy (8–72) applies to staff as well as students and remains interim. The actual email delivery/click path is verified manually (the Free-plan shared pooler validates recipient DNS at send time and rejects `@example.com`, and is rate-limited to 2 sends/hour — dev caveats, see `docs/PHASE0_RISK_REGISTER.md` 10.4); the server-side flow, activation, audit, and denials are covered by `tests/live/09-staff-auth.mjs`. Role labels `school_administrator` and `teacher` apply via migration `20261012000003`. The staff sign-in UI is part of the Phase 2 staff-facing slice; the API routes and `/join` acceptance page are the Phase 1 foundation. **Superseded in part by D-025:** the emailed invitation link and the `/auth/confirm` token-exchange route were replaced by a shareable activation link; the account is no longer created via GoTrue's invite endpoint.
- **Dependencies:** Auth email configuration (redirect allow-list) for the invite link; the Supabase CLI path (which needs the database password) for future migrations.
- **Approval:** Project owner, 2026-10-12.

### D-025: Shareable staff invitation links without email delivery

- **Status:** Confirmed
- **Date:** 2026-10-15
- **Context:** D-024 chose Supabase's built-in invitation email, which the project could not use reliably: the Free-plan shared mailer rejects `@example.com` recipients at send time (no MX/DNS), is rate-limited to 2 sends/hour, and depends on a verified sending domain and redirect allow-list that are not configured. Requiring email delivery also made invitation creation depend on an external service the school may not control, which does not fit community schools that often share links over WhatsApp, SMS or in person. A shareable, single-use activation link removes that dependency while keeping D-024's authentication, role and school-scoping decisions intact.
- **Decision:** Replace email-based staff invitations with shareable activation links:
  - **Delivery.** Invitation creation succeeds with **no email delivery**. The response returns a link of the form `<origin>/join#token=<64-hex>`; the administrator shares it through any channel they choose. The credential is a 32-byte (256-bit) random token, placed in the URL **fragment** so an ordinary HTTP request — and therefore a server, proxy or analytics access log — never receives it. It is sent to the server only in POST bodies.
  - **Storage.** A new server-only table `public.staff_invitations` (migration `20261015000004`) stores only a keyed hash of the token (`hashCredential`, keyed by `PORTAL_CREDENTIAL_SECRET` — the same rule as the student credential store), an `expires_at` of issued + 72 hours (the existing activation default), and `accepted_at`/`revoked_at`. Each row is bound to its school, membership, recipient, role and inviter. RLS is enabled with no policies; `anon`/`authenticated` are revoked. A DB-backed store is required because GoTrue's one-time-token lifetime is a single project-wide setting (raising it to 72 hours would also extend password-recovery and magic-link tokens) and it provides neither server-enforced revocation nor single-use claim.
  - **Acceptance.** An **unauthenticated** `POST /api/staff/invitations/accept` with `{ token, password }` claims the credential atomically (`UPDATE … WHERE accepted_at IS NULL … RETURNING`, so it cannot be replayed under concurrency), sets the recipient's password and confirms the email through the admin API, and activates the membership. The school, recipient and role come from the stored row, never from the request, so acceptance cannot be redirected to another school or role. A `POST /api/staff/invitations/preview` verifies a link without consuming it and returns only the recipient, role, school name and expiry.
  - **Revocation.** `POST /api/staff/invitations/revoke` (authorized administrator, own school only, `member.manage`) sets `revoked_at`. This is **non-destructive**: the shared link stops working immediately, while the pending account and `invited` membership remain dormant and unusable (no password, unconfirmed email).
  - **Re-invitation.** Inviting an email that already has an unaccepted invitation for the school revokes the previous link, issues a new one, and may correct the role.
  - **Activation fallback.** The D-024 first-confirmed-sign-in activation path remains as a safety net if membership activation is interrupted.
- **Reasoning:** Removes an external delivery dependency and the Free-plan mailer caveats; keeps a single-use, expiring, revocable credential; keeps the school boundary on the server; reuses the already-approved credential-hashing rule rather than inventing a second one.
- **Alternatives:** *Keep the built-in invite email* — rejected: unreliable on the Free plan and imposes a delivery dependency. *Token in a query parameter* — rejected: the credential would appear in request lines, access logs and `Referer` headers; the fragment avoids this. *Raise GoTrue's global `otp_expiry` to 72 hours instead of a DB table* — rejected: it would weaken all one-time tokens and provides no revocation or single-use guarantee. *A pure in-memory or signed-token scheme* — rejected: it cannot revoke or enforce single use without shared state.
- **Consequences:** An emailed link presumably proved control of the mailbox; a link shared out of band does **not** verify the address, so invitation acceptance should not be treated as proof the recipient owns the email. This is acceptable because access is still bounded by the school, role and permission checks, and the risk is recorded here rather than assumed away. `/auth/confirm` and `/api/staff/set-password` were removed. Invitation preview/accept are rate-limited (`invitationLimiter`). The staff-facing UI to create, share, list and revoke invitations is the Phase 2 slice and is not part of this decision's implementation.
- **Dependencies:** Migration `20261015000004_staff_invitations.sql` must be applied to each environment. A staff invitation-management UI (Phase 2).
- **Approval:** Project owner direction, 2026-10-15 (requested replaceable shareable activation links in place of email delivery).

### D-026: Phase 2 staff-facing surface — sign-in page, invitation dashboard, list endpoint

- **Status:** Confirmed and implemented, 2026-10-16. Scope derived from the D-024/D-025 references to the "Phase 2 staff-facing slice".
- **Context:** D-024 and D-025 both defer the staff-facing UI to a Phase 2 slice; Phase 1 delivered the invitation API and the `/join` acceptance page only. Staff therefore had no way to sign in through a UI, and an administrator had no place to see, share or revoke the links they had issued. This decision fixes what that slice contains so the shape is not re-invented during implementation.
- **Decision:**
  - **`/sign-in`** is a static page holding the sign-in form, posting to `POST /api/staff/sign-in`. It reads no cookies so it stays prerendered under Cache Components.
  - **`/dashboard`** is the administrator dashboard: create an invitation, copy the shareable link, see status and expiry, revoke, re-invite. With Cache Components enabled the session read renders behind a `<Suspense>` boundary, so the static shell is prerendered and the dynamic half streams in; an anonymous visitor receives a streamed redirect to `/sign-in` (the HTTP status of the shell is `200`, and the redirect arrives in the stream). Prerendering is stopped explicitly with `await connection()` at the top of the gate, so neither the session lookup nor the clock reads inside the Supabase auth client ever execute during a prerender pass — without it Next.js still walks the subtree and reports `blocking-prerender-current-time`. The gate is a user-experience redirect only — no authorization rests on it, and every action it performs repeats the identity, school and permission checks server-side.
  - **`GET /api/staff/invitations`** is a new read-only endpoint, authorized exactly like invite and revoke: the school is resolved from the caller's own active membership and `member.manage` is required via `has_school_permission`. It returns the 200 most recent rows for that one school — bounded rather than paginated; revisit if a school's invitation history grows.
  - The list returns **status, role and timestamps only — never the credential hash and never an activation link**, so a shared link cannot be read back out of the app by anyone, including its issuer. A link exists only in the response that created it; re-invite issues a fresh link (replacing the previous one) and revocation is the control for a link already in circulation.
  - Invitation display status is derived from `accepted_at` / `revoked_at` / `expires_at` in one pure module (`src/lib/staff/invitation-status.ts`) shared by the UI and the server list, so status means the same thing everywhere.
  - One design system per `docs/UI_UX_DOCUMENTATION.md` 10: CSS custom properties in `src/app/globals.css` (light and dark) plus reusable components in `src/components/ui/`. No CSS framework and no new runtime dependency.
- **Consequences:** The slice does **not** satisfy `docs/ROADMAP_AND_TESTING.md` 3.4's "first end-to-end school workflow" exit criteria — the Phase 2 workflow had already been chosen (student enrolment including class placement, D-018) and was implemented as a separate slice under D-027. Invitation timestamps are displayed in UTC (Ghana is UTC+0) so server and browser render identical text. `/dashboard` answers `200` to an anonymous HTTP request because the shell is prerendered; the redirect is delivered in the stream and is asserted that way by the live test. `tests/live/10-staff-dashboard.mjs` covers the authorization behaviour.
- **Dependencies:** None new — no migration, no new package. Relies on migration `20261015000004_staff_invitations.sql` from D-025 being applied.
- **Approval:** Project owner instruction to start Phase 2, 2026-10-16. No separate scope approval was requested for this slice; see `AGENTS.md` 18 report note where the D-024/D-025 use of "Phase 2" and the roadmap's formal Phase 2 differ.

### D-027: Phase 2 workflow — student enrolment with class placement

- **Status:** Confirmed and implemented, 2026-10-16. The workflow itself was already chosen by D-018 (2026-10-11); this decision records how the chosen workflow was delivered and its deliberate limits.
- **Context:** `docs/ROADMAP_AND_TESTING.md` 3.4 requires one approved workflow to be implemented end to end, exercises the whole architecture, and forbids the agent from assuming which workflow. That choice is D-018: **student enrolment, including class placement**. The enrolment rows, RLS policies and composite foreign keys were created by migration `20261011000001` (Phase 0/1) but no application path used them. This decision fixes the slice for the workflow.
- **Decision:**
  - **Scope** is register a student and place them in a class, plus see the school's students and classes. `GET /api/staff/classes`, `GET /api/staff/learners` (paged, with each student's current placement) and `POST /api/staff/learners` (register + initial placement in one request), behind the administrator-only Students page `/dashboard/learners`. Extending the existing dashboard with a permission-aware link keeps one app shell.
  - **Authorization is administrator-only via the permission catalogue, not role names:** `class.read`, `learner.read` and `learner.create`. As with the invitation slice, the school is resolved from the caller's own active membership and the permission is checked with `has_school_permission`; a shared helper (`src/lib/server/school-access.ts`) now performs the session → active membership → permission sequence once so the routes cannot drift.
  - **Row Level Security is the database-level boundary, not application code.** Uniquely for this workflow the writes deliberately run on the caller's **session client** rather than the server-only secret key, so the `learners` / `learner_class_placements` insert policies and the composite foreign keys (`placements_learner_school_fkey`, `placements_class_school_fkey`) enforce "one school" even if the handler were bypassed. `POST` therefore cannot place a student in another school's class, and the handler reports that as a `400` before the write.
  - **Validation is a pure, unit-tested module** (`src/lib/enrolment/requests.ts`): required names, gender enum, a real calendar date of birth not in the future and not before 1900, address and guardian phone, an optional guardian email, and a UUID class id. Registration numbers are normalised (`normaliseRegistrationNumber`) so the `(school_id, registration_number)` unique constraint is stable.
  - **Usernames are generated** with the approved helpers (`deriveUsernameBase` + `usernameWithSuffix`), resolved against existing usernames in the same school, and retried on a unique violation so a concurrent insert cannot collide. The username is unique within the school.
  - **Paging:** `GET /api/staff/learners` returns `LEARNER_PAGE_SIZE` (25) rows with an exact `total`, so a large school is not dumped in one response. No new migration and no new dependency.
- **Known limitations (deliberate, not defects):**
  - There is **no single-call transaction** across the two inserts (PostgREST exposes none, and adding a Postgres function requires a migration the environment cannot apply). To keep a partial failure recoverable, a repeat of the same request that finds an unplaced learner with that registration number **completes the placement** instead of failing as a duplicate, and reports `completedExisting: true`. This is documented in `src/lib/server/enrolment.ts` and asserted by a test path.
  - **Placement change, deactivation/reactivation and corrections are not in this slice** (they need `learner.update` / `learner.placement.manage` and a dedicated flow). Nothing in this slice hard-deletes a learner (`learners` has no delete policy), so the "deactivate, never delete" rule (D-023) holds.
  - The student list is **paged, not searchable**; and a learner whose class was later deactivated still shows its class name (the placement is historical).
- **Consequences:** The roadmap Phase 2 workflow is now implemented and its exit criteria are claimed for this workflow only. The learner detail is personal data about a child and is returned only to a caller holding `learner.read` in that school (`docs/SECURITY_AND_PRIVACY.md` 4). `tests/live/11-enrolment.mjs` covers the authorized, unauthorized, cross-school, duplicate and invalid-input paths plus the persisted placement.
- **Alternatives:** Using the server-only secret key (as the invitation slice does) was rejected — it would bypass the very RLS policies this workflow exists to exercise. A Postgres function for a true transaction was rejected only because the dev project cannot be migrated from this environment; it remains the preferred improvement once migrations can be applied.
- **Dependencies:** Relies on migration `20261011000001_enrolment_foundation.sql` being applied (it is, in `school-management-dev`). No new migration.
- **Approval:** Project owner instruction to implement the roadmap Phase 2 as well as the staff-facing slice, 2026-10-16.

### D-028: Phase 3 slice — school administration of classes and learners

- **Status:** Confirmed and implemented, 2026-10-16. Scope chosen by the project owner from the candidate list in `docs/ROADMAP_AND_TESTING.md` 3 (Phase 3), which states those capabilities are "not a commitment to implement all of them immediately".
- **Context:** Phase 3 ("Core school administration") lists five candidate areas: school profile and configuration, academic years and terms, classes and subjects, staff membership and assignments, and learner records and enrollment. Four of the enrolment tables already existed with RLS, composite foreign keys, audit triggers and permission-gated policies (migration `20261011000001`), but no application path could use them beyond the D-027 slice: a class could not be created through the app, a learner could not be corrected, deactivated or moved, and D-027 recorded those as known limitations. The remaining candidate areas (academic years/terms, subjects, staff assignments, school-profile editing) have no tables and would need a migration, which this environment cannot apply (no `SUPABASE_MGMT_TOKEN` / `SUPABASE_MGMT_PROJECT_REF`, no Supabase CLI) and therefore could not be built to the roadmap standard of "database constraints, authorization rules, UI states, and tests" against the real project.
- **Decision:** Implement the Phase 3 capability set that is fully backed by approved decisions and needs **no new migration**:
  - **Classes are administered, not just selected.** `POST /api/staff/classes` creates a class (`class.manage`); `POST /api/staff/classes/update` renames one and/or sets its active flag (`class.manage`). A class is **retired by deactivation, never deleted**: the application exposes no delete path, and a class any learner has ever been placed in cannot be deleted because `learner_class_placements` references it `ON DELETE RESTRICT` — keeping past placements interpretable requires the row to survive (D-023, `ENROLMENT_PERMISSION_MODEL` 5.2, 5.3). Deactivation removes a class from the enrolment selector while leaving existing placements intact. `GET /api/staff/classes` gains `?includeInactive=true` for the management page; the default stays active-only, so the enrolment selector is unchanged. Backed by `/dashboard/classes`, an administrator-only page.
  - **Learner corrections.** `POST /api/staff/learners/update` applies a partial correction under `learner.update`. Only the fields present in the body are written, so a correction cannot blank an unrelated column. The username is deliberately **not** re-derived: it is the stable sign-in identifier (`ENROLMENT_PERMISSION_MODEL` 7), not a display name. The `learners` audit trigger records the changed column names (5.4). Second-approval of corrections stays **off**, the approved default; an approval queue would implement provisional content (5.4, section 6).
  - **Deactivate, do not delete.** `POST /api/staff/learners/status` sets `status` to `active` or `inactive` under `learner.update`. There is no delete path; deactivation is the state change D-023 requires and is audited by the same trigger. Setting the status already in force is a no-op, so a repeated request writes no empty audit event.
  - **Placement change.** `POST /api/staff/learners/placement` moves a student under `learner.placement.manage`: the open placement is ended and a new one is opened, preserving one current placement per learner (5.5). An inactive student cannot be placed (`409`); an unplaced student can be placed, which also repairs a partial failure from D-027's non-transactional enrolment.
  - **The full record is read one learner at a time.** `POST /api/staff/learners/detail` returns one learner's address and guardian contact details under `learner.read`, for the correction form. Those fields are deliberately **not** added to the paged list, so listing a school does not disclose every child's address (`docs/SECURITY_AND_PRIVACY.md` 4). `POST` is used rather than a URL parameter so the internal student id never reaches an access log, matching the reasoning that put the D-025 invitation credential in a fragment.
  - **Action-to-permission mapping** (all held by `school_administrator` only, per D-021; `teacher` holds none): read classes `class.read`; create/rename/activate/deactivate a class `class.manage`; read one learner or list learners `learner.read`; correct a learner or change their status `learner.update`; change a placement `learner.placement.manage`.
  - **Writes run on the caller's session client**, as in D-027, so RLS and the composite foreign keys remain the enforcement point rather than the handler. A targeted write that matches no row in the caller's school is a `404` — the same response as a nonexistent one, so another school's row cannot be probed.
- **Reasoning:** This is the largest Phase 3 capability set that follows decisions already approved (5.2–5.5, D-023, D-021) without inventing product behaviour, and every part of it is verifiable end to end in this environment. It also closes the four limitations D-027 recorded. The Phase 3 areas that need new tables or new product decisions were left out rather than guessed at.
- **Alternatives:** (a) Writing and PGlite-verifying a migration for academic years, terms, subjects and staff assignments, leaving it unapplied and unverified live — rejected, because it could not be declared complete under `AGENTS.md` 6/13. (b) Waiting for a Management API token so all five areas could be built — declined by the owner for this slice; it stays available for the next one. (c) Extracting a shared page-header component and refactoring the two existing dashboard clients — deferred so this slice stays focused and the verified pages are untouched; the third inline copy is a recorded follow-up.
- **Consequences:** `GET /api/staff/learners` now returns **active students only by default**; inactive records are reached through an explicit `?status=inactive` view, which is how D-023's "not part of routine operational views" applies to the list. Deactivating a class leaves its learners placed in it (a placement is historical), so the enrolment selector and the student list can legitimately differ. The class-name uniqueness constraint is **exact-match and includes inactive classes**, so the application additionally rejects a name differing only in case (5.3), and a deactivated class keeps its name reserved until renamed. A placement change is two statements (end, then insert) because no single-call transaction is available; the partial unique index `placements_one_current_per_learner` guarantees one open placement regardless, and a failure between the two leaves an unplaced student who is repaired by repeating the request. No new dependency and no new migration.
- **Dependencies:** Relies on migration `20261011000001_enrolment_foundation.sql` being applied (it is, in `school-management-dev`). The remaining Phase 3 candidates stay blocked on a migration path and on the open "School operations" and staff suspension/removal questions in section 5.
- **Approval:** Project owner selected "Group A: enrolment administration" from the Phase 3 candidate list on 2026-10-16, after a scope and blocker report.

### D-029: Phase 3 completion — school settings, academic structure, subjects and staff administration

- **Status:** Confirmed and implemented, 2026-10-16. Scope chosen by the project owner ("all four areas, my defaults") from the four Phase 3 candidate areas that D-028 left blocked. Migration `20261016000005_phase3_administration.sql` is **applied and recorded** in `school-management-dev`.
- **Context:** D-028 implemented learner records/enrollment and classes but recorded that four Phase 3 candidate areas — school profile and configuration, academic years and terms, subjects, and staff membership and assignments — had no tables and could not be built without a migration, which the environment could not apply. A Supabase Management API token then became available (owner-supplied, temporary), so a migration could be written, applied to the non-production dev project and verified live, meeting the roadmap standard of "database constraints, authorization rules, UI states, and tests" (AGENTS.md 6/13). The open suspension/removal question (section 5, "Identity and access") was answered for this slice by reusing the approved D-023 state-change pattern.
- **Decision:** Complete the Phase 3 candidate areas with one migration and the following behaviour:
  - **School profile and configuration.** An authorized school administrator may edit the school `name` (`GET /api/staff/school`, `POST /api/staff/school/update`, `school.manage`); the school `code` stays **immutable** because students use it with a username to sign in (D-020). The tables are already school-scoped, so no new product decision was needed.
  - **Academic years and terms.** `academic_years` (school-scoped label, `starts_on`, `ends_on`, `is_current`) and `terms` (belonging to a year, with a label and dates) are new tables. A year is created/renamed and marked current via `GET`/`POST /api/staff/academic-years` and `POST /api/staff/academic-years/update` (`academic.read` / `academic.manage`); exactly one year per school may be current, enforced by the partial unique index `academic_years_one_current_idx` and, in the operation, by clearing the previous current year first. Terms are added and edited with `POST /api/staff/terms` and `/api/staff/terms/update`. Periods are stored, never assumed from a hard-coded calendar.
  - **Subjects.** `subjects` (school-scoped name, optional short code, `is_active`) is a new table. `GET`/`POST /api/staff/subjects` and `POST /api/staff/subjects/update` (`subject.read` / `subject.manage`) create, rename, re-code, activate and deactivate. A subject is **retired by deactivation, never deleted**; the application exposes no delete path.
  - **Staff membership and assignments.** `staff_assignments` links a membership to a class and/or a subject (both optional, at least one required) inside one school. `GET /api/staff/members` (`member.manage`) lists the school's staff and their assignments; the member email lives in Supabase Auth and is resolved with the server-only secret key, bounded to the membership ids already read for the caller's school. `POST /api/staff/assignments` and `POST /api/staff/assignments/delete` (`assignment.manage`) add and remove a link. `POST /api/staff/members/status` applies **suspend / restore / revoke** following D-023: a state change, never a hard delete; setting the status already in force is a no-op so a repeat writes no empty audit event; the `school_members` audit trigger records it. `has_school_permission` already ignores a non-active membership, so a suspended or revoked member loses access immediately.
  - **Permissions.** Six new permissions — `academic.read`, `academic.manage`, `subject.read`, `subject.manage`, `assignment.read`, `assignment.manage` — are granted to `school_administrator` only. Existing `school.manage` and `member.manage` are reused. A teacher keeps no permissions (D-021).
  - **Enforcement boundary.** Every read and write runs on the caller's **session** client (not the service role), exactly as D-018/D-027/D-028, so Row Level Security and the composite foreign keys are the boundary: the new tables get permission-gated select/insert/update policies, a `schools_update_managers` policy is added, and `staff_assignments` carries composite foreign keys to `school_members`, `classes` and `subjects` on `(id, school_id)`. A cross-school id is a `404` (or `400` when a composite foreign key rejects it), indistinguishable from a nonexistent one. User interfaces: the administrator-only `/dashboard/school` and `/dashboard/staff` pages, linked from the dashboard header.
- **Reasoning:** These are the four remaining Phase 3 candidate areas, and each maps to a question already in section 5 (school settings configurable by an authorized administrator; academic-year/term/class/subject rules configurable; staff suspension/removal) that the owner answered with "my defaults". Building them closes Phase 3 without inventing product behaviour, and every part is verifiable end to end.
- **Alternatives:** (a) Reusing the server-only secret key for the writes — rejected, it would bypass the RLS policies this slice exists to exercise. (b) Hard-deleting academic years, terms and subjects — rejected in favour of the project's retire-by-deactivation pattern for subjects, with no application delete path for any of them. (c) A "cannot revoke the last administrator" guard — deferred: it is a new policy decision the D-023 pattern does not contain, so it is recorded as a known limitation rather than invented here. (d) Extracting a shared page-header component now that a fourth and fifth page inline the same markup — deferred to keep this slice reviewable; still a recorded follow-up.
- **Consequences:** The Phase 3 candidate list is fully implemented; the exit criteria are claimed for the whole of Phase 3. Six permissions are added to the `school_administrator` catalogue. `schools` is now writable by an authorized administrator, so a school's display name can change while its sign-in code cannot. A suspended or revoked staff member keeps their membership row and its history. Known limitations: an administrator can suspend or revoke their own membership (no last-administrator guard); the new tables keep RLS delete policies (matching the existing `classes` pattern) even though the application has no delete path, so a hard delete would require a deliberate direct database action and is audited. No new dependency.
- **Dependencies:** Adds migration `20261016000005_phase3_administration.sql` (applied and recorded in `school-management-dev`); relies on migrations `20261011000001`–`20261015000004` already being applied.
- **Approval:** Project owner selected "All four areas, my defaults" on 2026-10-16, and supplied the temporary Management API token that made the migration path available.

### D-030: Phase 4 first slice — class attendance

- **Status:** Confirmed and implemented, 2026-10-17. Migrations `20261017000006_phase4_attendance`, `20261017000007_phase4_attendance_scope` and `20261017000008_phase4_attendance_fixture_cleanup` are **applied and recorded** in `school-management-dev`.
- **Context:** Phase 4 ("Teaching and academic workflows", `docs/ROADMAP_AND_TESTING.md`) lists attendance, assessments and results, academic summaries and reports, and relevant teacher workflows. `docs/DECISIONS.md` section 5 left the attendance and grading rules unvalidated, and `docs/PHASE0_RISK_REGISTER.md` rated attendance as the workflow most likely to require offline capture — a materially larger scope. This slice takes the bounded part: attendance on a class and date, with teacher workflows, deliberately **without** offline capture and **without** a timetable, so the owner chose four defaults on 2026-10-17 after being asked each question separately. Before starting, the dev project was found to already hold an `attendance_sessions`/`attendance_records` schema recorded as `20261017000001_attendance.sql` with no source file in the repository, no matching branch or worktree, and different, weaker rules (school-wide policies with no teacher class scope, no audit triggers, `DELETE` policies, no `attendance.report`). Both tables held zero rows, and the owner authorised a reset of that unversioned schema and re-application of the approved one.
- **Decision:** Attendance, on this basis:
  - **Statuses:** `present`, `absent`, `late`, `excused`. Nothing else, and no free text in place of a status.
  - **Scope and shape:** A register is a class on a date, optionally for one subject. There is **no timetable**: a session is identified by `(class, date, subject)`, enforced by a unique index, so a timetable table is not a prerequisite and periods are never assumed from a hard-coded calendar. Academic year and term are derived from the date when the school has a matching term, and left null otherwise — a school with no terms configured can still take attendance.
  - **Who may do what.** A teacher takes and corrects attendance **for the classes they are assigned to** through `staff_assignments`; an administrator may do the same for any class in their school and may view per-class reports. Teacher scoping is enforced in the database, not only in the application: `can_access_class(school, class)` is true only for a holder of `attendance.report` or an active membership assigned to that exact class, and every policy is gated on it. A teacher holding no assignment sees an empty class picker and can reach no register.
  - **Correction window.** A teacher may change a register while its date is still today; only a holder of `attendance.report` (an administrator) may correct an earlier one. This is a business rule rather than an access rule, so it is enforced in trusted server code and returned as a distinct `closed_for_teacher` reason. `attendance.correct` is additionally required before changing marks that already exist.
  - **The register is submitted whole.** Every learner currently in the class must be marked, once each, and a learner who is not on the roll is refused. A partially submitted register is indistinguishable from a complete one, which would silently understate absence. Re-submitting unchanged marks is idempotent.
  - **Least privilege for the teacher.** The teacher holds `attendance.read`/`attendance.record`/`attendance.correct` and **still holds no `learner.read`**, `class.read` or `subject.read`; those stay administrator-only because they expose whole-school learner-facing configuration. The teacher takes a register through two `SECURITY DEFINER` functions gated on `can_access_class`: `class_roster` returns only id, registration number and name for the class, and `accessible_classes` / `class_subjects` return class and subject names only. No date of birth, address, guardian contact or portal state crosses that boundary. `attendance.report` is granted to `school_administrator` only.
  - **Attendance is a record, not a state.** There is **no delete path**: no delete policy exists on either table and `anon`/`authenticated` hold no `DELETE` grant. A register is corrected by writing it again, and every change is audited by the `audit_row_change` trigger with its actor. `DELETE` is granted to `service_role` alone so non-production test fixtures can be cleaned up — the server-only secret key already bypasses RLS by design, and the invariant that matters to a user is that no session can delete attendance at any permission level.
  - **Boundaries on the work itself.** A session date may not be in the future; a register holds at most 200 learners; a report window is bounded to 366 days, so no unbounded attendance aggregation is possible.
  - **Enforcement boundary.** Every read and write runs on the caller's **session** client, as in D-018/D-027/D-028/D-029. Composite foreign keys keep a session with its class/subject/year/term and a record with its session and learner, all in one school. A cross-school or out-of-scope id is a `404`, indistinguishable from one that does not exist. Interface: `/dashboard/attendance`, linked from the dashboard header on `attendance.record` or `attendance.read`.
- **Reasoning:** Attendance was the recommended lead for Phase 4: it is the first workflow a teacher performs, it exercises the whole pattern end to end, and it does not require the grading rules that section 5 still lists as unvalidated — inventing those would breach AGENTS.md 17. Choosing class scope as the teacher's boundary follows from attendance being a child-data record (AGENTS.md 7) and from `staff_assignments` already existing (D-029). The four defaults were put to the owner as separate questions because they trade staff autonomy against record integrity, and "same-day only" was chosen over an approval workflow to keep the slice free of a new state machine.
- **Alternatives:** (a) Assessments and results first — rejected: `docs/PRD.md` 11 lists grading differences between schools as unvalidated, so results would require inventing rules. (b) A timetable first — rejected as a prerequisite; attendance keyed on class and date does not need it. (c) Whole-school attendance for teachers, as the unversioned schema had — rejected: it would expose every class's learner attendance to every teacher. (d) An approval workflow for corrections — deferred; it needs a new state machine and an approval queue, which is a larger slice than this one. (e) Partial register submission — rejected because an incomplete register cannot be told apart from a complete one.
- **Consequences:** The teacher role is no longer permission-free; D-021's "start at zero and fail closed" becomes "start at zero and grant only what a feature needs, scoped as narrowly as the feature allows". `tests/database/enrolment-foundation.test.ts` was updated accordingly, and now asserts the teacher holds *only* the three attendance permissions and nothing administrator-only. Known limitations: **today is UTC**, not a configurable school timezone — Ghana is UTC+0 so the two agree today, but a school west of UTC would see a differing day boundary and fixing it needs a school timezone setting, which is a separate decision. `academic_year_id`/`term_id` are derived and nullable, and nothing yet groups a report by term. There is no offline capture, no per-learner report page, no bulk import, and no `class.read`/`subject.read` for teachers, so a teacher cannot browse a class outside their assignments. No new dependency.
- **Dependencies:** Adds migrations `20261017000006`, `20261017000007` and `20261017000008` (applied and recorded in `school-management-dev`); relies on `20261016000005_phase3_administration.sql` for `subjects`, `academic_years`, `terms` and `staff_assignments`, which attendance depends on. `tests/live/02-seed.mjs` cleanup was extended to delete attendance and the D-029 tables in dependency order, which it had not been doing.
- **Approval:** Project owner answered four scope questions on 2026-10-17 (statuses, correction policy, no timetable, attendance plus administrator class reports), and authorised resetting the unversioned attendance schema found in the dev project and re-applying the approved migrations.

## 5. Decisions Required Before Relevant Features

These questions do not all need to be answered immediately. Resolve each one before it materially affects implementation.

### Product scope

- The first complete vertical slice is student enrolment including class placement (D-018). Any change to that choice is a scope decision.
- Which modules beyond enrolment are required for the first usable release? **Partially resolved 2026-10-17** — D-030 takes class attendance as the first Phase 4 module. Assessments and results remain blocked on the unvalidated grading rules below; academic summaries beyond the per-class attendance report remain open.
- Which user roles and permissions are necessary initially? **Resolved 2026-10-12** — D-021: initial roles are Platform Owner, School Administrator, Teacher, and Student (Parent/Guardian access deferred). Required before enrolment authorization is implemented; each role's permission catalogue assignments remain feature-driven.
- Which features should be available without additional payment or subscription arrangements?

### School operations

- Which academic-year, term, class, subject, and enrollment rules must be configurable? **Partially resolved 2026-10-16** — D-029: an authorized administrator configures academic years (label and dates, one current), their terms, subjects (name, optional code, active flag) and classes; periods are stored, never hard-coded. Grading, reporting and assessment rules remain open for Phase 4.
- Which grading and reporting rules are required?
- What school-specific workflows differ enough to require configuration?
- Which school settings must be configurable by an authorized school administrator? **Partially resolved 2026-10-16** — D-029: the school display name is editable; the school code is immutable because it is used at student sign-in (D-020). Other settings remain open.

### Identity and access

- Which roles exist at school level? **Resolved 2026-10-12** — D-021: School Administrator, Teacher and Student at school level; Platform Owner is platform-level (cross-school). The permission catalogue content per feature remains to be decided.
- Which platform-level administrative capabilities are required? **Partially resolved 2026-10-12** — D-021: Platform Owner is a narrow, enumerated capability set that never grants unrestricted access to student or school records, and every Platform Owner access is explicitly authorized and audited. The concrete capability list is defined with the features that need it.
- What is the approved process for inviting, suspending, and removing users? **Partially resolved 2026-10-12** — D-024: staff invitations are approved (an authorized school administrator invites by email; the invited membership activates on first sign-in); **revised 2026-10-15** — D-025: delivery is a shareable single-use activation link, not email, and a re-invite replaces a previous unaccepted link. **Suspension/removal partially resolved 2026-10-16** — D-029 defines suspend / restore / revoke as audited state changes on the membership, following the D-023 pattern; a membership is never hard-deleted.
- ~~What is the approved approach for student portal authentication?~~ **Resolved** — D-020 (Confirmed): server-mediated school-code + username sign-in over an internal, non-deliverable account identifier, with Supabase Auth verifying the password. See `docs/ENROLMENT_PERMISSION_MODEL.md` 8.4.
- Membership in more than one school is excluded from the first release by D-017. The conditions under which it may be introduced remain open.

### Data and privacy

- Which learner and staff fields are necessary? **Partially resolved:** the learner registration fields are settled by D-019; staff fields and any non-enrolment learner fields remain open.
- Which records must be retained, archived, exported, or deleted? **Partially resolved 2026-10-12** — D-023 establishes an interim retention framework: no permanent deletion merely because a student leaves (leaving is recorded by enrolment state), access to inactive records is restricted, sensitive actions are audited, and no retention period is set without a documented purpose. Specific periods, and Ghanaian legal and school-specific obligations, remain to be validated before real-school onboarding.
- Which privacy notices, agreements, and legal requirements apply?
- Which third-party services will process personal information?

### Operations

- Which hosting plan meets the initial requirements? **Partially resolved 2026-10-12** — development hosting is fixed (D-013: local Next.js + the existing `school-management-dev` Free project); the production plan, with Vercel as the proposed application-hosting option, remains subject to compatibility, cost and capability validation.
- What backup frequency and retention are needed? **Partially resolved 2026-10-12** — D-022 records a proposed RPO 24 h target that implies a backup cadence at least as fine; the concrete frequency, backup retention, and any point-in-time recovery decision are validated during production-readiness.
- What recovery objectives are acceptable? **Resolved as proposed targets 2026-10-12** — D-022: RPO 24 hours, RTO 24 hours; targets, not verified guarantees, until backup capability, a restoration test and cost are verified.
- What monitoring and operating costs are acceptable?
- Under what circumstances should a school move to dedicated infrastructure?

## 6. Decision-Making Rules

1. Do not treat a proposed technology as approved merely because it appears in a technical document.
2. Verify version compatibility, provider limitations, and costs before committing to a dependency.
3. Prefer the simplest architecture that satisfies the confirmed requirements and security constraints.
4. Do not introduce unnecessary services, abstractions, or infrastructure.
5. Do not weaken tenant isolation to simplify implementation.
6. Do not make consequential product, security, legal, financial, or deployment decisions without the required owner approval.
7. Record the reason for a significant decision and any meaningful alternatives considered.
8. When new evidence invalidates an existing decision, explain the evidence and propose a change rather than silently changing direction.

## 7. Decision Record Template

Use this format for future significant decisions.

### D-XXX: [Decision title]

- **Status:** Proposed / Confirmed / Open / Superseded
- **Date:** YYYY-MM-DD
- **Context:** What problem or requirement prompted the decision?
- **Decision:** What was agreed or proposed?
- **Reasoning:** Why is this the preferred approach?
- **Alternatives:** What meaningful alternatives were considered?
- **Consequences:** What trade-offs, costs, or constraints follow?
- **Dependencies:** What must be verified or completed first?
- **Approval:** Who approved the decision?

## 8. Implementation Rule

Before starting a task, the implementation agent must check the relevant requirements in this document and the other authoritative project documentation.

If a task depends on an unresolved decision, the agent must identify the dependency and ask for approval when necessary. It may continue with independent, safe work that does not rely on the unresolved decision.

This document must reflect actual approved decisions. Do not mark a proposal as confirmed merely because the agent implemented it.
