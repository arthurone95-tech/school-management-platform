# Product Requirements Document (PRD)

**Project:** School Management Platform\
**Primary market:** Community schools in Ghana\
**Document status:** Initial requirements baseline\
**Version:** 1.2

## 1. Product Vision

Build a reliable, secure, configurable school management platform that helps community schools in Ghana manage their operations efficiently, even where internet connectivity is unreliable.

The platform should support multiple schools through one primary codebase and shared application deployment while keeping each school's records, users, configuration and operations properly isolated.

The product must be designed for real school environments, including varying digital skills, shared devices, limited bandwidth and different school administration practices.

## 2. Problem Statement

School administration can involve disconnected records, repetitive data entry, manual calculations, difficult reporting and limited access to reliable historical information.

A digital platform can improve these workflows, but it must avoid introducing new problems such as expensive infrastructure, unnecessary complexity, unreliable synchronization or unauthorized access to student records.

The specific problems and their severity must be validated with representative schools before finalizing the minimum viable product (MVP).

## 3. Target Users

The following are proposed user categories. Confirm actual roles and responsibilities during school discovery.

- **Platform administrator:** Manages platform-level operations, school onboarding and platform configuration.
- **School proprietor or authorized administrator:** Manages school settings, staff membership and enabled features.
- **Headteacher:** Oversees authorized academic and administrative activities.
- **Teacher:** Accesses assigned classes, subjects and permitted student records.
- **Accounts or bursary staff:** Handles financial workflows if those modules are approved.
- **Parent or guardian:** Potential future user with access limited to verified relationships and authorized information.
- **Student:** Potential future user, depending on the needs and age groups of participating schools.

Not every role must be implemented in the first release.

## 4. Product Goals

1. Provide a dependable foundation for managing multiple schools.
2. Enforce strict separation between schools' data.
3. Make common school workflows straightforward and efficient.
4. Support school-specific settings and independently configurable modules.
5. Work well on phones, tablets and desktop computers; responsive support across those devices is mandatory, not optional (see 9.1).
6. Support selected offline workflows without compromising data integrity or privacy, and behave predictably on slow or interrupted connections (see 9.2).
7. Maintain accurate, recoverable records.
8. Allow new features to be introduced without unnecessarily rebuilding the platform.
9. Keep initial infrastructure and maintenance manageable.
10. Provide a migration path to dedicated infrastructure for a school when justified by future requirements.

## 5. Core Product Principles

### 5.1 Multi-tenancy by design

Every school must have its own logical workspace. Users may access only the schools and records for which they have verified authorization.

School separation must be enforced by the database and server-side authorization, not merely by filtering information in the user interface.

### 5.2 Configuration without separate applications

Schools should share the same application while being able to configure supported settings and enable or disable available modules independently.

A school-specific setting must not change the underlying security requirements.

### 5.3 Progressive development

Build a secure foundation, deliver one complete and validated workflow, test it with real users using appropriate test data, and expand based on evidence.

Do not attempt to implement every conceivable school feature simultaneously.

### 5.4 Offline awareness

Design for unreliable connectivity from the beginning. However, offline access must be explicitly defined for each workflow. The platform must not promise that every feature will work without internet access.

Mandatory low-connectivity behaviour is specified in 9.2. Offline support never relaxes the tenant-isolation and authorization requirements in 5.1.

### 5.5 Privacy by default

Collect only information needed for a defined purpose. Restrict access, minimize local storage, protect exports and establish appropriate retention and recovery procedures.

## 6. Initial Scope

The initial foundation should include:

- Application structure and environment configuration.
- Authentication and school membership.
- Server-side role and permission enforcement.
- School onboarding and workspace configuration.
- Database design and versioned migrations.
- Database-level tenant isolation.
- A responsive application shell.
- Module availability configuration.
- Audit records for important administrative and data changes.
- Automated testing and continuous integration.
- Backup and recovery planning.
- A foundation for installable PWA capabilities and carefully scoped offline support.

These are foundation requirements, not a claim that the functionality already exists.

## 7. MVP Feature Selection

The first end-to-end workflow is **student enrolment, including class placement** (D-018). Its scope is limited to creating and managing a student's enrolment within an authorized school and assigning the student to a class.

Candidate workflows considered and deferred include student enrolment, class assignment, attendance, assessment records and academic reporting.

Before extending beyond enrolment, investigate:

- Which administrative task creates the greatest recurring difficulty?
- How frequently is the task performed?
- Who performs it and who approves corrections?
- What information is required?
- What happens when internet connectivity fails?
- What reports or exports are necessary?
- What errors or privacy risks exist in the current process?

Select a workflow that is valuable, sufficiently bounded and practical to test end to end.

## 8. Non-Goals for the Initial Release

Unless discovery establishes a compelling requirement, do not initially assume the product needs:

- A separate codebase or deployment for every school.
- A full native Android or iOS application.
- Every school administration module at launch.
- Payroll, biometric attendance or GPS tracking.
- AI-based high-stakes educational decisions.
- Payment processing or third-party integrations before their need is established.
- Parent and student portals before the core school workflows are validated.
- A single user account holding membership in more than one school (see D-017). The capability remains architecturally possible and is not foreclosed.

These features may be considered later through explicit scope decisions.

## 9. Quality Requirements

The platform must be designed for:

- **Security:** Verified authorization and tested tenant isolation.
- **Reliability:** Clear error handling, recoverable failures and verified backups.
- **Performance:** Fast operation on realistic devices and connections.
- **Responsive design:** Usable, tested layouts on mobile phones, tablets, and desktop and laptop computers (see 9.1).
- **Low connectivity:** Predictable behaviour, clear feedback and protection of entered information on slow, unstable or interrupted connections (see 9.2).
- **Usability:** Understandable workflows and clear feedback.
- **Accessibility:** Keyboard support, readable text, sufficient contrast and accessible form errors.
- **Maintainability:** Modular code, documented decisions and automated tests.
- **Scalability:** Sensible database indexing, measured performance and a documented path to greater isolation.
- **Data integrity:** Validation, relational constraints, controlled corrections and conflict handling.
- **Privacy:** Data minimization, appropriate retention and restricted exports.

### 9.1 Mandatory Responsive Design

The application MUST provide a fully responsive and usable experience across:

- **Mobile phones:** Common Android and iOS screen sizes.
- **Tablets:** Layouts and interactions adapted to tablet screen sizes and orientations.
- **Desktop and laptop computers:** Appropriate layouts for larger screens.

Requirements:

- All core workflows must remain usable across supported screen sizes.
- Layouts must adapt appropriately; desktop layouts must not simply be squeezed onto mobile screens.
- Navigation, forms, tables, dashboards, dialogs, buttons and other interactive elements must be usable on touchscreens and with desktop input methods.
- Ordinary workflows must not require unintended horizontal scrolling.
- Text must remain readable, controls must be appropriately sized, and important actions must not become inaccessible on smaller screens.
- Responsive behaviour must be tested at representative mobile, tablet and desktop viewport sizes.
- Responsive design is a mandatory product requirement, not an optional future enhancement.

### 9.2 Low-Connectivity and Offline Requirements

The application MUST be designed for schools that may experience slow, unstable or interrupted internet connectivity.

- Provide clear loading, connection-status, failure, retry and synchronization feedback where applicable.
- Handle interrupted requests without silently losing user-entered information whenever technically feasible.
- Define offline support separately for each approved workflow.
- Do not assume that every feature must work offline.
- Before implementing an offline workflow, document its permitted offline actions, locally stored data, synchronization behaviour, conflict handling, failure recovery and security implications.
- Do not claim that the application is fully offline-capable unless that capability has been implemented and verified.
- Protect locally stored school and student data, particularly on shared, lost or stolen devices.

Offline support must not weaken authentication, authorization, database security or school-data isolation, and must not introduce a blanket requirement to cache all school data on users' devices. These requirements are consistent with, and do not change, the confirmed decisions recorded in `docs/DECISIONS.md`.

### 9.3 Accessibility Target

WCAG 2.2 Level AA is the accessibility target for the product. It applies to every user-facing interface feature, not only to the first release.

- Meet the target as the general rule for keyboard access, semantic structure, labels and error association, contrast, focus visibility, text enlargement and accessible names.
- Where a specific screen cannot meet part of the target, record the exception, its justification, and the affected devices or screen sizes.
- An exception is a documented, justified deviation for a specific case. It does not lower the general target and does not remove the requirement to meet it elsewhere.
- Follow `docs/UI_UX_DOCUMENTATION.md` 11 for detailed practice.

## 10. Success Measures

Establish baseline measurements during discovery and pilot testing.

Potential measures include:

- Time required to complete the selected workflow.
- Frequency of data-entry errors and duplicate records.
- Successful synchronization rate for approved offline workflows.
- Number of unresolved synchronization conflicts.
- Coverage of cross-school access-denial tests.
- Successful backup restoration and recovery exercises.
- User task completion and satisfaction.
- Responsive layout defects observed at representative mobile, tablet and desktop viewport sizes.
- Share of common tasks completed on a phone rather than a desktop.
- Approved offline workflows whose synchronization, conflict handling and recovery behaviour has been tested.
- Support requests and recurring usability problems.

Do not invent numerical targets before obtaining a meaningful baseline.

## 11. Constraints and Assumptions

The initial direction is one primary codebase, one shared application deployment and an initial shared production Supabase project with strict school-level isolation. Supabase is the confirmed backend direction (D-012, D-015).

Development begins on the Supabase Free plan. The Free plan is **not** approved as a production configuration: it carries usage limits that do not support real schools, and its projects pause after inactivity. The production plan, its actual limits, and its cost must be reviewed and approved before any real school is onboarded.

The product should be web-first and support installation as a PWA where compatible.

The following remain subject to validation:

- Actual school workflows and required modules.
- School sizes and expected user volumes.
- Device availability and shared-device practices.
- Connectivity and power reliability.
- Hosting budget and data residency requirements.
- Academic calendar and grading differences.
- Applicable Ghanaian privacy, child-protection and contractual obligations.
- Recovery objectives. Proposed initial production targets are recorded (D-022): RPO 24 hours, RTO 24 hours. These are **targets, not verified guarantees**, and do not become commitments until verified; see 12.

## 12. Release Acceptance

A release must not be considered ready merely because the application builds successfully.

The relevant workflows must meet their acceptance criteria, authorization tests must pass, database changes must be reviewed, failures must be handled safely, and operational recovery requirements must be tested. Responsive behaviour must be verified at representative mobile, tablet and desktop viewport sizes, and each feature's declared connectivity behaviour must be confirmed by testing rather than by claim.

Before using real student records, review privacy, access, retention, support and incident-response procedures.

Production onboarding additionally requires that the production hosting plan and its actual limits have been reviewed and approved (the proposed application-hosting option is Vercel, D-013), and that the recovery targets (D-022: RPO 24 hours, RTO 24 hours) and a verified restoration test have been established. A development or free-tier environment must not be used to onboard a real school.

## 13. Change Management

Update this document when an approved product decision materially changes the scope or goals.

Record significant architectural and security decisions in `docs/DECISIONS.md`.

Requirements that remain unvalidated must be labelled as assumptions or proposals rather than treated as confirmed facts.
