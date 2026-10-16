# UI/UX Documentation

**Project:** School Management Platform\
**Document status:** Initial interface requirements\
**Version:** 1.1

## 1. Purpose

This document defines the user-interface and user-experience principles for the school management platform.

The platform serves community schools in Ghana. The interface must be practical for school administrators, teachers, and other authorized users who may have different levels of digital experience and may work with limited connectivity or lower-cost devices.

The goal is a clear, reliable, accessible, and professional application rather than a visually complex dashboard.

## 2. Core Design Principles

The interface must prioritize:

- Clarity over decoration.
- Fast completion of common school tasks.
- Consistent navigation and interaction patterns.
- Clear feedback for successful, failed, and pending operations.
- Responsive layouts for phones, tablets, and desktop computers.
- Readable text and accessible controls.
- Minimal unnecessary data entry.
- Safe handling of sensitive records.
- Predictable behavior under slow or interrupted connections.

Do not add visual complexity, animations, dashboards, or features without a clear user benefit.

## 3. Target Devices and Connectivity

The initial product is a web application designed to work well in modern desktop and mobile browsers.

It should be PWA-capable if the selected architecture supports the required features safely.

The interface must:

- Adapt to small mobile screens without horizontal overflow in ordinary workflows.
- Remain usable on tablets and desktop screens.
- Provide visible loading and connection states.
- Avoid unnecessary large assets and expensive client-side operations.
- Preserve user-entered information when safe and practical.
- Handle timeouts and failed submissions without misleading the user.
- Make retry behavior clear.

Do not advertise offline support for a workflow until its offline behavior has been implemented and tested.

## 4. User Roles and Navigation

The exact navigation structure must follow the approved feature set.

Potential user groups include:

- Platform administrators.
- School administrators.
- Teachers and other school staff.
- Other school-authorized users introduced by approved features.

Each user must see only the navigation items relevant to their role and active school context.

Hiding a navigation item is a usability measure, not a security control. The backend must independently enforce authorization.

### 4.1 School context

A single account holds membership in one school in the first release (D-017), so school switching is not user-facing behaviour yet. The interface must still be designed so that switching can be added later without redesign: school context must never be implied by a stale view, and cached or displayed data must be bound to the resolved school.

Do not silently switch school context during a sensitive operation.

### 4.2 Navigation consistency

Use a consistent navigation structure across the application.

Users should be able to identify:

- Where they are.
- Which school they are working in.
- What actions they can take.
- How to return to a previous or primary view.
- Whether a change has been saved.

Avoid duplicate navigation paths that lead to the same action unless there is a clear usability reason.

## 5. Dashboard Design

A dashboard should help users understand the current state of their work and reach common tasks quickly.

Do not fill the dashboard with arbitrary number cards, charts, or widgets simply to make it look populated.

Every dashboard element must answer a real user question or support a frequent task.

Examples of potentially useful elements, subject to approved features, include:

- Relevant upcoming school activities.
- Tasks requiring attention.
- A short summary of recent activity.
- Shortcuts to frequently used workflows.
- Clear notices about incomplete setup or operational problems.

Show only information the current user is authorized to access. Do not expose sensitive learner information in broad dashboard summaries.

## 6. Forms and Data Entry

Forms should be designed for speed, accuracy, and error prevention.

Requirements:

- Use clear labels rather than relying on placeholder text alone.
- Mark required fields clearly.
- Group related fields logically.
- Use suitable input types and sensible defaults.
- Validate input on the client for convenience and on the server for security.
- Explain validation errors near the relevant fields.
- Preserve entered values after recoverable errors where safe.
- Prevent accidental duplicate submissions.
- Clearly distinguish saving, saved, failed, and pending states.
- Request confirmation for destructive or consequential actions.
- Avoid asking for the same information repeatedly when a safe, authoritative value is already available.

For long forms, consider sections or progressive disclosure where it reduces cognitive load without hiding important requirements.

## 7. Tables, Lists, and Records

School records may be difficult to review on small screens.

Choose the presentation pattern based on the task:

- Tables for comparison across structured fields.
- Lists or cards for compact mobile record browsing.
- Detail views for reviewing a specific record.
- Search and filtering for larger collections.

Avoid forcing wide desktop tables onto mobile screens without a deliberate responsive strategy.

Provide clear empty states, loading states, and error states. Distinguish an empty result from a failed request.

Where records can be edited or deleted, make the available actions clear and apply appropriate authorization on the backend.

## 8. Feedback and Error Handling

Every important user action should have a clear outcome.

The interface must distinguish between:

- Loading.
- Saved successfully.
- Failed to save.
- Waiting for synchronization.
- Offline or disconnected.
- No matching records.
- Access denied.
- A conflict requiring user attention.

Do not show success messages until the relevant operation has actually succeeded.

Error messages should explain the problem and the next reasonable action without exposing internal implementation details or sensitive information.

For example, a recoverable network failure should not erase a completed form without warning.

## 9. Destructive and Sensitive Actions

Actions such as deleting records, changing permissions, removing memberships, recording consequential financial changes, or changing school settings require appropriate safeguards.

Depending on the action, safeguards may include:

- A clear description of the consequence.
- A confirmation step.
- Reauthentication for particularly sensitive operations.
- A reversible archive instead of immediate permanent deletion.
- An audit event.
- A clear success or failure result.

Do not use confirmation dialogs for every ordinary action. Reserve them for meaningful risks.

## 10. Visual Design System

Establish a consistent design system before building multiple feature screens.

Define reusable tokens and components for:

- Typography.
- Spacing.
- Colors.
- Page layout.
- Navigation.
- Buttons and links.
- Form controls.
- Tables and lists.
- Dialogs and notifications.
- Status indicators.
- Loading placeholders.
- Empty and error states.

Use color consistently and never rely on color alone to communicate status.

Keep visual hierarchy clear. Primary actions should be visually distinct without making every element compete for attention.

Prefer reusable components to duplicated, slightly different implementations of the same control.

## 11. Accessibility

WCAG 2.2 Level AA is the accessibility target for the product (D-016, `docs/PRD.md` 9.3). Meet it as the general rule.

At minimum:

- Provide keyboard-accessible interactions.
- Use semantic HTML elements.
- Associate form labels and error messages with their fields.
- Maintain adequate text and control contrast.
- Provide visible focus indicators.
- Use accessible names for icon-only controls.
- Do not rely exclusively on color, position, or icons to communicate meaning.
- Support browser zoom and reasonable text enlargement.
- Announce important asynchronous status changes appropriately.
- Ensure dialogs and menus can be operated and dismissed accessibly.

Test important workflows with keyboard navigation and automated accessibility tools. Automated checks do not replace manual review.

Where a specific screen cannot meet part of the target, record the exception, its justification, and the affected devices or screen sizes, as required by `docs/FEATURE_SPECIFICATIONS.md` 13.1. An exception is specific to that case and does not lower the general target.

## 12. Localization and Ghanaian Context

The initial product is intended for Ghanaian schools.

Design for local school terminology and practical workflows. Confirm actual user terminology rather than assuming every school uses identical administrative language.

Use explicit date formats and avoid ambiguous numeric dates where confusion is possible.

Use the appropriate currency format for financial features. Where currency values are stored, retain the currency code or otherwise make the currency unambiguous.

Do not hard-code assumptions about school calendars, class structures, academic years, grading systems, or school fees. Make these configurable where the approved requirements justify it.

The interface should remain suitable for future localization without requiring a complete redesign.

## 13. Performance and Low-Connectivity UX

Keep common workflows efficient on modest devices and unstable networks.

Use pagination or incremental loading for large record collections.

Avoid unnecessary full-page reloads and redundant requests where the architecture supports efficient updates.

For operations that may take time, provide progress or pending-state feedback where feasible.

When a request fails, explain whether the user can retry and whether the operation may already have completed. Avoid retrying sensitive operations blindly if doing so could create duplicates.

## 14. Privacy in the Interface

Display only the information needed for the current task.

Avoid exposing personal learner details in notifications, public URLs, browser titles, analytics events, or broad dashboard summaries unnecessarily.

Use appropriate access checks before showing sensitive information.

Consider shared devices and shared workspaces when designing logout, session expiration, school switching, and locally cached data.

Do not treat visual masking as a substitute for authorization.

## 15. UX Testing

Test the principal workflows with realistic users and devices where possible.

Evaluate:

- Whether users can identify the correct school context.
- Whether common tasks can be completed without unnecessary steps.
- Whether errors are understandable.
- Whether users can recover from interrupted requests.
- Whether mobile layouts remain usable.
- Whether users can complete workflows using a keyboard.
- Whether role-specific navigation is understandable.
- Whether sensitive information appears only where expected.

Record observed problems and prioritize fixes based on severity and frequency.

## 16. Implementation Gate

Before building multiple feature screens, establish a small reusable design system and validate it through the first complete end-to-end workflow.

**Established 2026-10-16 (D-026), ahead of the first feature screens.** Design tokens (light and dark, `prefers-color-scheme`, `prefers-reduced-motion`, a 3px visible focus ring and a 4.5:1 body-text target) are CSS custom properties in `src/app/globals.css`; reusable primitives live in `src/components/ui/` — `Button` (variants, sizes, `aria-busy` loading state, `type="button"` by default), `TextField`/`SelectField` (label, hint and error wired through `aria-describedby` and `aria-invalid`, ids generated with `useId`), `Alert` (`role="alert"` for errors, `role="status"` otherwise), `Card`, and `InvitationStatusBadge` (status written as text, never colour alone). The staff sign-in page and `/dashboard` are its first consumers, and the invitation list switches to stacked rows below 30rem rather than scrolling horizontally. The system is deliberately small: add a primitive when a screen needs one; do not restyle existing screens merely because another approach is available. **Validated through the first end-to-end workflow (D-018, D-027).** The students screen (`/dashboard/learners`) reuses those primitives without adding any: the enrolment form is a responsive grid (`1` column on small screens, `2` above 40rem) of the same `TextField`/`SelectField`, its success and error feedback use `Alert` (`role="status"` / `role="alert"`), and the student list reuses the invitation list's visual pattern (generalised in `src/app/globals.css` to a shared record list) with a status badge written as text and stacked rows below 30rem. The class selector and student list each carry explicit loading, empty and error states, and the layout was checked for horizontal overflow at 320, 375, 768 and 1280px. **Extended by the administration slice (D-028).** The classes screen (`/dashboard/classes`) is a third consumer of the same primitives and follows the record-list pattern (create form, then a list with inline rename and activate/deactivate, no horizontal scrolling below 30rem). The students screen gained an active/inactive filter, an inline detail editor that fetches a single student's full record on demand, an inline class change, and deactivate/reactivate with a confirmation step — all reusing `Button`, `TextField`, `SelectField` and `Alert`, with no new primitive. The page header markup is currently written inline by each screen; extracting it into a shared component is a recorded follow-up rather than a change made mid-slice.

Do not redesign the entire application repeatedly while the core data model and authorization behavior remain unsettled.

Visual quality must support usability, trust, accessibility, and operational reliability.
