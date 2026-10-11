# Architecture and Product Decisions

**Project:** School Management Platform\
**Document status:** Living decision record\
**Version:** 1.2

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

Validated 2026-10-11 against the confirmed Supabase direction (D-012, D-015). Next.js 16.3.8 is Active LTS and requires Node.js 20.9 or later and TypeScript 5.1 or later. Supabase maintains first-party App Router support through `@supabase/ssr`. No concrete blocker was found in the framework and language pairing. The integration risks identified during validation are recorded in `docs/PHASE0_RISK_REGISTER.md`.

Subject to the existing documented requirements and compatibility constraints in `docs/SYSTEM_ARCHITECTURE.md`.

### D-012: Database and authentication

**Status:** Confirmed

Supabase PostgreSQL and Supabase Auth, with Supabase Storage if required.

Use PostgreSQL constraints and RLS to enforce appropriate data-access restrictions. Authentication alone is not sufficient to establish school-level permissions.

See D-015 for the evaluated alternatives, the trade-offs accepted, and the conditions that would justify revisiting this choice.

### D-013: Hosting

**Status:** Open

Select an appropriate hosting provider after checking compatibility with the chosen framework, deployment requirements, cost, reliability, and operational capabilities.

Do not assume a particular provider has been selected.

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
- **Consequences:** The project accepts that provider capability is verified only for the specific features used, and must be re-verified before production use. The service-role credential that bypasses RLS remains the single highest operational risk and continues to be governed by `docs/DATABASE_DOCUMENTATION.md` 5.2 and `docs/SYSTEM_ARCHITECTURE.md` 5; that risk is inherent to any privileged database credential and is not removed by choosing a different provider. Cost is not yet bounded: point-in-time recovery is an additional paid add-on, and no recovery objectives have been agreed. Migration away from Supabase remains feasible because the database is PostgreSQL and exports are portable.
- **Dependencies:** Before production, confirm the production plan and its actual limits, agree recovery objectives, verify backup restoration in a non-production environment, and confirm data residency and processor terms against applicable Ghanaian requirements. See `docs/SECURITY_AND_PRIVACY.md` 5.
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
- **Consequences:** The enrolment schema carries required columns for the fields above, a composite unique constraint on `(school_id, registration_number)`, and a username unique within the sign-in namespace. Portal access state is modelled separately from enrolment status. The first implementation slice still excludes portal screens; only the model is fixed. Permanent deletion remains subject to an approved retention policy before production (`docs/ENROLMENT_PERMISSION_MODEL.md` 5.2).
- **Dependencies:** The student portal authentication approach, which Supabase Auth cannot satisfy natively — see D-020. The class and placement model in `docs/ENROLMENT_PERMISSION_MODEL.md` 5.3 and E1.
- **Approval:** Project owner.

### D-020: Student portal authentication approach

- **Status:** Proposed
- **Date:** 2026-10-11
- **Context:** D-019 requires students to sign in with a username and password without owning, or being required to provide, a personal email address. The project owner directed that this be evaluated against Supabase Auth before implementation, without inventing fake email addresses or building a custom authentication system.
- **Evidence (verified 2026-10-11 against vendor documentation):**
  - Supabase Auth identity types are **email, phone, OAuth and SAML**. Password sign-in requires either an email address or a phone number. There is no username identity, and Supabase has stated it does not intend to add username/password as a first-class sign-in mechanism.
  - *Permanent* users — those able to sign back in after signing out — are tied to a piece of personally identifiable information: an email, a phone number, or a third-party identity. *Anonymous* users cannot sign back in after sign-out and therefore cannot serve as student accounts.
  - The extension points available without a custom auth system are **Auth Hooks** (Postgres functions; `Before User Created` and `Custom Access Token` are available on Free and Pro) and **third-party authentication** (Clerk, Auth0, Firebase Auth, Cognito, WorkOS), the latter being a separate paid dependency outside D-014.
  - Phone-based sign-in requires an SMS provider, a paid external dependency; students in the target age group may not hold a phone.
- **Conflict to resolve:** The requirements "no email required from students", "no invented fake email addresses", "no custom authentication system" and "zero cost" cannot all hold simultaneously through Supabase Auth, because it has no username identity and its only non-third-party permanent identity options are email or phone. At least one constraint must bend.
- **Proposed decision:** Use **server-mediated username sign-in** over an opaque, platform-controlled, non-personal account identifier, and treat that identifier explicitly as an internal account key rather than an email address. **Owner approval of this interpretation is required**, or one of the alternatives below must be chosen.
  - The account identifier lives in a reserved, provably non-deliverable namespace that the platform controls and that a third party cannot register or hijack.
  - Email-based flows for these accounts are disabled. Recovery is administrator-assisted under D-019 (section 8.3); no mail is ever sent to the identifier.
  - Sign-in runs in a trusted server route: it receives the username and password, resolves the username to the account identifier from a protected table, calls Supabase `signInWithPassword`, and establishes the session cookie through `@supabase/ssr`. The secret key never reaches the browser.
  - The password is passed only to Supabase Auth. The platform never stores, logs, or displays it. This is **not** a custom password-storage mechanism.
- **Reasoning:** This is the only option that keeps Supabase Auth as the identity provider, keeps student accounts recoverable, requires no email from the student, and adds no paid dependency. All username logic is confined to trusted server code and one protected table — a small, auditable surface.
- **Alternatives:** *Supabase phone authentication* — requires a paid SMS provider (D-014) and assumes students hold phone numbers; rejected for the target age group. *Third-party identity provider* — paid, adds a second identity system and operational surface with no driving requirement; rejected. *Custom authentication in the application* — rejected outright by `docs/SECURITY_AND_PRIVACY.md` 6 and `AGENTS.md` 5. *Requiring a personal email after all* — rejected by the owner's requirement and contrary to data minimisation. *Deferring the student portal entirely* — retained as the immediate practical path: Phase 1 and the first slice use staff email/password authentication only, so portal authentication is needed only when the portal slice begins.
- **Consequences:** The account identifier is an internal implementation detail and must be documented as such, so no later contributor treats it as a real mailbox or enables email delivery to it. Username resolution becomes a security-sensitive server path that must be rate-limited and must not leak account existence. Tenant isolation, RLS and the staff authentication model are unaffected. If the interpretation is rejected, the portal requires either a paid SMS provider or a paid identity provider, and D-014 must be revisited.
- **Dependencies:** A Supabase project to prove the flow (`signInWithPassword` against a server-created account, session cookies via `@supabase/ssr`, disabled email flows), owner approval of the identifier trade-off, and confirmation that the chosen reserved namespace passes Supabase's email-format validation.
- **Approval:** **Pending — project owner.** Not approved. Do not implement until approved and proven against a real project.

## 5. Decisions Required Before Relevant Features

These questions do not all need to be answered immediately. Resolve each one before it materially affects implementation.

### Product scope

- The first complete vertical slice is student enrolment including class placement (D-018). Any change to that choice is a scope decision.
- Which modules beyond enrolment are required for the first usable release?
- Which user roles and permissions are necessary initially? Required before enrolment authorization is implemented. Still open; the interim default is in `docs/ENROLMENT_PERMISSION_MODEL.md` 5.1 and 6.
- Which features should be available without additional payment or subscription arrangements?

### School operations

- Which academic-year, term, class, subject, and enrollment rules must be configurable?
- Which grading and reporting rules are required?
- What school-specific workflows differ enough to require configuration?
- Which school settings must be configurable by an authorized school administrator?

### Identity and access

- Which roles exist at school level?
- Which platform-level administrative capabilities are required?
- What is the approved process for inviting, suspending, and removing users?
- What is the approved approach for student portal authentication, given that Supabase Auth has no username identity and requires email or phone for a permanent account? See D-020 (Proposed) and `docs/ENROLMENT_PERMISSION_MODEL.md` 8.4.
- Membership in more than one school is excluded from the first release by D-017. The conditions under which it may be introduced remain open.

### Data and privacy

- Which learner and staff fields are necessary? **Partially resolved:** the learner registration fields are settled by D-019; staff fields and any non-enrolment learner fields remain open.
- Which records must be retained, archived, exported, or deleted?
- Which privacy notices, agreements, and legal requirements apply?
- Which third-party services will process personal information?

### Operations

- Which hosting plan meets the initial requirements?
- What backup frequency and retention are needed?
- What recovery objectives are acceptable?
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
