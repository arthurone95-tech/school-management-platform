# Roles and Features — PENDING

Source: `docs/ROLES.docx` ("Complete School Management System: Roles, Responsibilities and Features").
Method: each item in the source document was checked against the code, API routes, database migrations and approved decisions in `docs/DECISIONS.md`.

## Status key

- **Partial** — part of the feature exists, but it is not usable end-to-end (for example an API with no interface, or a placeholder page).
- **Not built** — no implementation found.
- **Not verified** — the restriction is expected to hold but could not be confirmed in a read-only audit.
- Fully implemented items are **not** repeated here. They are in `docs/ROLES_IMPLEMENTED.md`.

---

## 1. Administrator / Headmaster

### A. Dashboard and School Overview

- (Partial) Overall school statistics — only a small set of metrics is shown
- (Not built) Male and female student counts
- (Partial) Active and inactive student counts
- (Not built) Enrolment by class and year group
- (Not built) Upcoming examinations and assessments
- (Not built) Upcoming school events
- (Not built) Pending administrative tasks
- (Partial) Academic performance summaries
- (Not built) Compare academic performance across classes
- (Not built) School-wide academic progress view
- (Not built) System notifications

### B. Student Management

- (Partial) Complete student profiles
- (Not built) Registration date and time recorded per student
- (Partial) Unique student identification numbers (system internal ID)
- (Not built) Upload passport photograph
- (Not built) Multiple parents/guardians per student
- (Not built) Previous schools
- (Partial) Academic histories
- (Partial) Attendance histories
- (Partial) Assessment/exam results on the student record
- (Not built) Health or emergency statement
- (Not built) Print student profiles and admission reports
- (Not built) Print student lists
- (Partial) Search/filter by name, ID, class, gender and status

### C. Teacher and Staff Management

- (Partial) Register teachers and staff (invitation-based; no full staff record form)
- (Not built) Staff identification numbers
- (Partial) Registration date and time recorded per staff member
- (Not built) Edit staff profiles
- (Not built) Upload staff photograph
- (Not built) Qualifications
- (Not built) Transfer between departments
- (Not built) View teacher timetables
- (Not built) Print staff lists
- (Not built) Export staff information

### E. Academics — Academic Year and Term Management

- (Partial) Create and edit academic years
- (Partial) Create terms
- (Partial) Set opening and closing dates
- (Partial) Vacation periods
- (Partial) Activate the current year and term
- (Partial) Close completed terms
- (Partial) Historical records
- (Partial) Academic calendars
- (Partial) Student academic histories
- (Partial) Schedule school activities

### E2. Examination Management

- (Partial) Assign exam supervisors
- (Not built) Monitor examination preparation
- (Partial) Monitor marks submission
- (Partial) Track completion
- (Not built) Generate examination reports
- (Not built) Print timetables and registers
- (Partial) Publish approved results

### F. Assessment and Grading Management

- (Partial) Compulsory and optional subjects
- (Partial) Create and edit class names in the custom framework
- (Partial) Assessment components and weightings
- (Not built) Class-specific grading rules
- (Partial) Exam and continuous assessment structures
- (Partial) Term result calculations
- (Partial) Overall performance calculations
- (Not built) Assessment periods

### G. Results

- (Not built) Approve/reject results
- (Not built) Return results for correction
- (Partial) Authorize result changes with an audit trail
- (Partial) Lock finalized results
- (Partial) Generate report cards
- (Not built) Subject performance reports
- (Partial) Print/download results

### H. Attendance Management

- (Partial) View daily attendance
- (Partial) View attendance by class
- (Not built) View attendance by individual student
- (Not built) Teacher attendance
- (Not built) Staff attendance
- (Not built) Early departures
- (Not built) Attendance percentages
- (Not built) Repeated absenteeism detection
- (Partial) Daily, weekly and monthly reports
- (Not built) Print attendance registers
- (Partial) Correct attendance with authorization and audit

### I. Parent and Student Account Management

- (Partial) Create student portal accounts
- (Partial) Activation codes and invitation links
- (Not built) Parent/guardian access — deferred under D-021
- (Not built) Link parents to their children
- (Partial) Secure credential generation
- (Partial) Activate/deactivate portal accounts
- (Partial) Password reset and recovery
- (Partial) Activation status
- (Not built) Last login information
- (Not built) Disable compromised accounts
- (Partial) Portal permissions
- (Partial) Help users recover access

### J. Communication and Announcements

- (Not built) Create announcements
- (Not built) Publish to all school or selected classes
- (Not built) Messages to teachers, parents, students, groups or individuals
- (Not built) Exam announcements
- (Not built) Event information
- (Not built) Reminders
- (Not built) Schedule, edit, delete and archive messages
- (Not built) Delivery status
- (Not built) Notification channels

### K. School Settings

- (Partial) Academic levels
- (Not built) Departments
- (Not built) Notification preferences
- (Partial) Roles and permissions (fixed labels; no configuration interface)

### M. Security and System Administration

- (Partial) Staff permissions
- (Partial) Specific access rights
- (Partial) Activity logs
- (Not built) Login histories
- (Not built) Suspicious activity detection
- (Partial) Record of who created, edited or approved a change
- (Not built) Revoke sessions
- (Not built) Password recovery
- (Partial) Audit log viewing (data is captured, but there is no viewer)
- (Not built) Export permissions
- (Not built) Backups and restore
- (Not built) Security settings

---

## 2. Teachers

### A. Teacher Login and Dashboard

- (Not built) Change password
- (Not built) Account recovery
- (Partial) Personal dashboard (teacher view is a placeholder)
- (Partial) Assigned classes on the dashboard
- (Partial) Assigned subjects on the dashboard
- (Not built) Timetable
- (Not built) Upcoming lessons
- (Not built) Upcoming examinations
- (Partial) Pending marking activities
- (Not built) Pending result submissions
- (Not built) School announcements
- (Not built) Messages and notifications
- (Not built) Daily teaching schedule
- (Partial) Class attendance summaries

### B. Class Management

- (Partial) View students in assigned classes
- (Not built) Student profiles
- (Not built) Student photographs
- (Partial) Attendance histories where authorized
- (Partial) Previous academic performance
- (Partial) Class lists
- (Not built) Download class lists
- (Not built) Print class registers
- (Not built) Identify students falling behind
- (Not built) Learning support information

### C. Attendance Management

- (Not built) Attendance percentages
- (Not built) Identify frequently absent students
- (Partial) Generate class attendance reports
- (Not built) Download/print attendance registers

### D. Teaching and Lesson Management

- (Not built) Academic syllabus
- (Not built) Curriculum topics, standards and indicators
- (Not built) Lesson plans
- (Not built) Record topics taught
- (Not built) Syllabus coverage tracking
- (Not built) Lesson completion
- (Not built) Upload teaching materials
- (Not built) Share resources
- (Not built) Notes and presentations
- (Not built) Learning activities
- (Not built) Homework creation from the teaching view
- (Partial) Class exercises
- (Not built) Revision materials
- (Partial) Monitor lesson progress
- (Not built) Teaching observations

### E. Assessment and Examination Management

- (Partial) Create class exercises, assignments, quizzes and tests
- (Not built) Prepare/upload examination questions
- (Not built) Save draft marks
- (Not built) Submit marks for approval
- (Not built) Rejection feedback
- (Not built) Correct rejected marks
- (Partial) Class performance statistics
- (Partial) Subject performance reports
- (Partial) Download/print mark sheets

### F. Student Performance Monitoring

- (Partial) Individual performance
- (Partial) Previous results
- (Partial) Compare across assessments
- (Not built) Identify weak and high-performing students
- (Not built) Track progress over time
- (Partial) Subject performance
- (Not built) Learning difficulties
- (Not built) Academic observations
- (Not built) Remedial recommendations
- (Not built) Support records
- (Not built) Improvement monitoring

### G. Homework and Assignments

- (Not built) Create homework
- (Not built) Assign homework to classes
- (Not built) Deadlines
- (Not built) Supporting documents
- (Not built) Learning materials
- (Not built) View assigned homework
- (Not built) Student submissions
- (Not built) Download submissions
- (Partial) Marking
- (Partial) Feedback
- (Not built) Identify non-submitters
- (Not built) Return marked work

### H. Communication

- (Not built) Message students in assigned classes
- (Not built) Message parents where authorized
- (Not built) Class announcements
- (Not built) Homework reminders
- (Not built) Examination information
- (Not built) Academic progress updates
- (Not built) Receive parent messages
- (Not built) Receive administrator announcements
- (Not built) Teacher-to-teacher messaging
- (Not built) System notifications

### I. Class Teacher Responsibilities

- (Partial) Overall class performance
- (Partial) Attendance across subjects
- (Not built) Attendance patterns
- (Not built) Subject teachers for the class
- (Partial) Progress across subjects
- (Not built) General observations
- (Partial) Class reports
- (Partial) Performance summaries
- (Not built) Communicate class matters to parents
- (Not built) Behaviour monitoring
- (Not built) Recommend support
- (Partial) Class records

---

## 3. Students / Parents

The portal is at the authentication-skeleton stage: sign-in and account activation work, but there is no student data screen. Parent/Guardian access is deferred under D-021.

### A. Login and Account Access

- (Not built) Activate an account using an invitation link (code-only flow is built)
- (Partial) Change password — admin-assisted reset only, no self-service screen
- (Partial) Recover forgotten password — admin-assisted only
- (Not built) Update permitted profile information
- (Not built) View account information
- (Partial) Log out securely — no portal sign-out control
- (Partial) Access on mobile, tablet and desktop — auth screens are responsive, but no real workflow exists to test
- (Partial) Register students and issue activation credentials without email — registration works, but no administrator interface issues the credentials

### B. Student Dashboard

- (Not built) View student dashboard
- (Not built) View student name
- (Not built) View class
- (Not built) View school name
- (Not built) View academic year and term
- (Not built) View announcements
- (Not built) View upcoming events
- (Not built) View pending tasks
- (Not built) View quick links

### C. Results and Report Cards

- (Not built) View term results
- (Not built) View subject marks
- (Not built) View grades
- (Not built) View position/rank
- (Not built) View teacher remarks
- (Not built) View overall performance
- (Not built) View previous term results
- (Not built) View cumulative performance
- (Not built) Download or print report card
- (Not built) View class position
- (Not built) View pass/fail status

### D. Attendance

- (Not built) View own attendance
- (Not built) Daily/monthly summary
- (Not built) Attendance percentage
- (Not built) Dates absent
- (Not built) Dates late
- (Not built) Authorized absences
- (Not built) Attendance by subject
- (Not built) Attendance alerts

### E. Timetable

- (Not built) View class timetable
- (Not built) Subject teachers
- (Not built) Lesson times
- (Not built) Exam timetable
- (Not built) Daily/weekly view

### F. Homework and Assignments

- (Not built) View assigned homework
- (Not built) Deadlines
- (Not built) Instructions
- (Not built) Supporting documents
- (Not built) Submit homework
- (Not built) View feedback and scores
- (Not built) View marked work
- (Not built) View missing assignments
- (Not built) View class exercises

### G. Learning Materials

- (Not built) View notes/slides
- (Not built) Download materials
- (Not built) View curriculum/topics
- (Not built) View learning activities
- (Not built) View revision materials
- (Not built) View recorded lessons

### H. Communication

- (Not built) Receive announcements
- (Not built) Receive messages from teachers
- (Not built) Receive exam information
- (Not built) Receive event information
- (Not built) Receive homework reminders
- (Not built) Message teachers
- (Not built) Message administration
- (Not built) View notification history

### I. Profile and Account

- (Not built) View personal information
- (Not built) View photograph
- (Not built) View registration number
- (Not built) View parent/guardian information
- (Not built) View previous schools
- (Not built) Change permitted information
- (Partial) Change password — admin-assisted only
- (Not built) Notification preferences

### J. Conduct and Discipline

- (Not built) View conduct remarks
- (Not built) View behaviour records
- (Not built) View disciplinary actions
- (Not built) View achievements and awards
- (Not built) View teacher observations

### K. Restrictions — status

- (Not verified) Student sees only their own information — no student data view exists yet
- (Not built) Parent sees only their linked child or children — no parent role or link table
- (Not verified) Student cannot view other students — no portal read path; fail-closed by design
- (Not verified) Student cannot edit marks or results — no portal write path
- (Not verified) Student cannot access another school — no live student-session test
- (Not verified) Student cannot change official registration data — no portal write path

---

## 4. Other System Features and Modules

### A. Library Management

- (Not built) Book catalogue; add/edit/remove books; ISBN, category and author; issuing and returns; due dates; renewals; reservations; fines; catalogue search; borrowing history; low-stock alerts; barcode printing; inventory export

### B. Transport Management

- (Not built) Vehicle registration; routes and stops; student route assignments; driver information; maintenance; fuel records; transport fees; bus attendance; route planning; parent notifications

### C. Health and Medical Records

- (Not built) Medical history; allergies; conditions; medications; emergency contacts beyond guardian phone/email; health records; sick bay visits; first aid records; immunization; health reports; health-specific privacy controls

### D. Discipline and Behaviour Management

- (Not built) Incident reports; behaviour records; disciplinary actions; sanctions; warnings; suspensions; behaviour trends; parent notifications; counselling records; positive recognition; behavioural reports

### E. Communication and Messaging

- (Not built) SMS; email; in-app messaging; announcements; newsletters; parent-teacher messaging; group messaging; broadcasts; scheduled messages; delivery reports; templates; notification preferences

### F. Events and Calendar

- (Partial) School events — database table and API exist, but no usable interface
- (Partial) Event creation, dates and times — API only
- (Not built) Venues
- (Not built) Participant assignment
- (Not built) Invitations
- (Not built) Reminders
- (Not built) Event gallery
- (Not built) Public calendar
- (Not built) Print schedule

### G. Document Management and Storage

- (Partial) Upload documents — school logo only, image-only, client-side checks
- (Not built) Student files
- (Not built) Staff files
- (Not built) School policies
- (Not verified) Permission-based access — no storage policies in the repository; a public URL is used
- (Not built) Version history
- (Not built) Download and sharing
- (Partial) File size limits — client-side only
- (Not verified) Secure storage — policies not present in the repository

### H. Analytics and Reporting

- (Not built) Custom reports
- (Not built) Enrolment trends
- (Partial) Performance analytics — fixed academic report and GES result card
- (Partial) Attendance analytics — bounded class report
- (Not built) Financial summaries
- (Not built) Comparative reports
- (Not built) Scheduled reports
- (Partial) Export to PDF/Excel — CSV export and browser print only; no PDF or spreadsheet library
- (Not built) Charts and data visualisation

### I. Human Resources and Payroll

- (Not built) Staff personal records beyond login and membership; employment contracts; salary records; payroll; payslips; tax records; leave management; staff attendance; performance appraisals; recruitment; onboarding; termination records

### J. Timetable Management

- (Not built) Class timetables
- (Not built) Teacher timetables
- (Not built) Room allocation (only a free-text room on exam slots)
- (Partial) Subject scheduling — examination subjects only
- (Partial) Clash detection — exam room double-booking only
- (Not built) Substitute teachers
- (Not built) Print timetables
- (Not built) Drag-and-drop editing

### K. Inventory and Asset Management

- (Not built) School supplies; stock levels; purchase orders; suppliers; asset register; asset assignment; depreciation; maintenance; low-stock alerts; disposal; stocktake

### L. Admission and Enrolment

- (Not built) Online application forms
- (Not built) Applicant records
- (Not built) Admission criteria
- (Not built) Document upload for applicants
- (Not built) Interview scheduling
- (Not built) Admission decisions
- (Not built) Waiting lists
- (Not built) Admission letters
- (Partial) Enrolment confirmation — staff-managed learner registration, not an applicant-facing flow
- (Not built) Intake management

### M. Examination Management (school-wide / external)

- (Not built) External exam registration
- (Not built) Candidate lists
- (Not built) Exam fees
- (Not built) Exam centres
- (Not built) Candidate numbers
- (Not built) External result upload
- (Not built) Certificate management
- (Not built) Past papers
- (Not built) Exam archives
- (Partial) Result analysis — internal academic report and GES analysis only

### N. Backup, Security and System Administration

- (Not built) Automated backups
- (Not built) Manual backup
- (Not built) Restore
- (Partial) Audit logs — captured in the database, but no viewer interface
- (Not verified) User access logs — no application sign-in audit event found
- (Not built) IP restrictions
- (Not verified) Two-factor authentication — no in-repo configuration or interface
- (Partial) Password policies — length validation only
- (Partial) Role management — fixed role labels, membership status changes
- (Partial) Permission configuration — data in the database, no interface
- (Not built) System health
- (Not built) Uptime monitoring
- (Not built) Error logs

---

## Navigation and wording status

- **Resolved:** the sidebar now links to the implemented **Examinations** and **Grading** screens instead of labelling them "Coming soon".
- **Resolved:** the dashboard's **Subjects** checklist item now links to Assessment settings instead of saying "Coming soon".
- **Resolved:** the landing page no longer claims students can view results or print report cards in the portal. Student result viewing remains unbuilt.
- **Accurate as "Coming soon":** the sidebar entries for **Accounts**, **Communication** and **Security**; none of these modules is built.
- **Accurate as "Coming soon":** the landing page entries for **Fees and receipts** and **Announcements and SMS**.

---

## Features explicitly not needed or ruled out

The source document does not mark any feature as "not needed". The following are excluded or rejected by **approved decisions** rather than merely unbuilt, so they should not be treated as ordinary pending work:

- **Offline attendance capture** — explicitly out of scope for the attendance slice (D-030).
- **A timetable as a prerequisite for attendance** — explicitly rejected; attendance is keyed on class, date and optional subject (D-030).
- **Position/rank in the custom grading framework** — recorded as a known limitation of that framework (D-031); rankings are provided in GES mode (D-034).
- **Parent/Guardian as a separate initial role** — deferred, not rejected, by D-021; it is listed under pending rather than here.
- **Phone/SMS-based student authentication** — rejected because it assumes students own phones and needs a paid SMS provider (D-020, D-014).
- **A custom in-application authentication system** — rejected by the security requirements; Supabase Auth is the approved direction.
- **Membership in more than one school in the first release** — excluded by D-017.
