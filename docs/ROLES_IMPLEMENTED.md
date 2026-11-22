# Roles and Features — IMPLEMENTED

Source: `docs/ROLES.docx` ("Complete School Management System: Roles, Responsibilities and Features").
Method: each item in the source document was checked against the code, API routes, database migrations and approved decisions in `docs/DECISIONS.md`.

## Status key

- **Implemented** — a usable interface exists and is backed by a working API/data path.
- **Partial** and **Not built** items are **not** listed here. They are in `docs/ROLES_PENDING.md`.
- An item is not repeated across roles or modules. Where the same feature appears in two parts of the source document, it is listed once with a cross-reference.

---

## 1. Administrator / Headmaster

There is no `headmaster` role in code. The approved school-level administrator role is `school_administrator` (`docs/DECISIONS.md` D-021).

### A. Dashboard and School Overview

- Log in to the administrative dashboard
- See the total number of registered students
- See the total number of teachers and staff
- Shortcuts to frequent functions (quick actions)

### B. Student Management

- Register students
- Edit student information
- School registration numbers
- Personal information: date of birth, gender, residential address
- Parent/guardian phone and email
- Assign students to classes
- Transfer students between classes
- Deactivate withdrawn students while preserving their history
- Export learner records (audited CSV export)

### C. Teacher and Staff Management

- Assign teachers to subjects
- Assign teachers to classes
- Employment/account status (active or inactive)
- Activate and deactivate staff accounts

### E. Academics — Academic Year and Term Management

- Examination periods
- View previous years
- Prevent unauthorized changes to closed periods

### E2. Examination Management (internal examinations)

- Create exam schedules
- Set exam dates
- Assign subjects
- Assign venues/rooms
- Exam timetables (schedules and slots)
- Manage exam records

### F. Assessment and Grading Management

- Select the grading framework (GES/NaCCA or custom)
- Configure custom grading bands
- Manage subjects under the custom framework
- Remove/deactivate classes
- Edit subject names and codes
- Grading scales
- Grade descriptions and remarks

### G. Results

- Monitor marks submission
- View submitted marks
- Identify missing marks
- Class performance reports
- Export performance data

### H. Attendance Management

- Late arrivals
- Absent students
- Authorized (excused) absences
- Export attendance data

### K. School Settings

- Edit school name
- Upload school logo
- School address and contact details

### M. Security and System Administration

- Create administrator accounts
- Assign administrator roles
- Restrict access to sensitive records (server-side permissions and RLS)
- Suspend staff accounts

---

## 2. Teachers

### A. Teacher Login and Dashboard

- Log in with an assigned account

### B. Class Management

- View assigned classes
- View student registration numbers

### C. Attendance Management

- Take daily class attendance
- Mark present, absent or late
- Add attendance remarks
- Edit records within the authorized correction period
- Submit attendance records
- View previous attendance records

### D. Teaching and Lesson Management

- View assigned subjects

### E. Assessment and Examination Management

- Record continuous assessment marks
- Record exam marks
- Edit marks before submission
- View submitted marks
- Grading calculations
- Grades

### J. What Teachers Must Not Access — enforced

The following restrictions are enforced through server-side permission checks and database row-level security:

- The entire school administration dashboard
- Registering or removing students
- Deleting student accounts
- Changing official registration numbers
- School-wide academic settings
- Grading framework and band configuration
- Creating or deleting administrator accounts
- Staff employment records
- Confidential staff records
- Other teachers' private information
- Other classes' confidential records
- Publishing finalized results without approval
- Changing locked results
- System security settings
- Information belonging to another school

---

## 3. Students / Parents

Parent/Guardian access is deferred under D-021. Only the student authentication flow is built.

### A. Login and Account Access

- Open the school portal
- Log in using assigned credentials (school code, username and password)
- Activate an account using the school's activation code
- Create their own password during activation

### K. Restrictions — enforced

- Students cannot access the administrator or staff dashboard
- Students cannot access school settings

---

## 4. Other System Features and Modules

### F. Events and Calendar

- Academic calendar (academic years and terms) — see also Administrator → Academics

### H. Analytics and Reporting

- Basic school metrics dashboard — see also Administrator → Dashboard

### J. Timetable Management

- Exam timetables (internal examinations) — see Administrator → Examinations

### N. Backup, Security and System Administration

- Data export — see Administrator → Student Management and Results

---

## Notes

- The landing page describes student sign-in without claiming result viewing. Student sign-in is built; **viewing results in the student portal is not** (see the pending file).
- The sidebar now links directly to the implemented **Examinations** and **Grading** screens; only genuinely unbuilt modules remain under "Coming soon". The dashboard's **Subjects** checklist item links to Assessment settings.
