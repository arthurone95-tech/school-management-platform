# School Management Platform — Immediate Launch Tasks (AGENT_NOW.md)

**Target:** Prepare system for live school onboarding, testing, and terminal report generation.  
**Focus:** Core attendance toggles, terminal report workflow, headmaster sign-off, report card printing, fee summaries, and basic profile health fields.

---

## Task Breakdown

### 1. Attendance Module Toggle (School Settings)
- **Database / API:**
  - Add `enable_attendance` boolean (default `true`) to `schools` settings.
  - Expose in `/api/staff/school/update` and school context resolution.
- **Frontend UI:**
  - Add toggle switch in School Settings: "Enable Daily Attendance Module".
  - When toggled OFF, hide attendance from sidebar navigation and disable attendance routes for that school.
  - When toggled ON, enable daily class attendance registers.

### 2. Terminal Report Card & Headmaster Sign-off Workflow
- **Teacher Workflow:**
  - Class teachers enter 50/50 GES or Custom scores, conduct ratings, and Class Teacher remarks.
  - Report cards remain in `DRAFT` status while being filled by class teachers.
- **Headmaster Confirmation & Signature:**
  - Headmaster/Admin interface to view class report cards.
  - Headmaster adds **Headmaster Remark** and clicks **Confirm / Approve Report**.
  - Headmaster signature upload feature in School Settings (supports image upload processed into clean black & white / transparent signature display).
- **Report Card Printing Rules (Admin, Teacher, and Student/Parent Portal):**
  - **Before Confirmation:** Report cards can be printed, but Headmaster Signature and Headmaster Remark are hidden/locked.
  - **After Confirmation:** Report cards print with Headmaster Remark and clean Headmaster Signature displayed.
- **Fee Calculation Summary on Report Card:**
  - At the bottom of the terminal report card, include a financial summary section displaying:
    - Arrears / Owed Fees
    - Next Term Estimated Fees
    - Total Balance Due

### 3. Student / Parent Portal Terminal Report Access
- Ensure students and parents logging into `/portal/home` can view and print their official terminal report cards (respecting the confirmation lock rules).

### 4. Health & Medical Status Field (Internal Profile Only)
- Add optional `health_status` text field to Student and Staff registration and edit forms.
- Display `health_status` internally on the staff/student profile page.
- Ensure `health_status` is kept private and **never** printed on terminal report cards.

---

## Verification & Quality Gates
1. Run `npm run typecheck` (0 errors).
2. Run `npm run lint` (0 errors).
3. Run `npm test` (all tests pass).
4. Run `npm run build` (Next.js production build succeeds).