/**
 * Shared view types for the Phase 3 administration areas (school profile,
 * academic years and terms, subjects, staff membership and assignments).
 *
 * Isomorphic (no database imports) so both the server operations and the
 * browser clients can speak the same shapes (docs/DECISIONS.md D-029).
 */

export interface SchoolProfile {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: string;
  readonly physicalAddress: string | null;
  readonly primaryPhone: string | null;
  readonly secondaryPhone: string | null;
  readonly officialEmail: string | null;
  readonly website: string | null;
  readonly logoUrl: string | null;
}

export interface TermSummary {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
  readonly status: string;
  readonly vacationStart: string | null;
  readonly vacationEnd: string | null;
  readonly examStart: string | null;
  readonly examEnd: string | null;
}

export interface AcademicYearSummary {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
  readonly status: string;
  readonly isActive: boolean;
  readonly terms: readonly TermSummary[];
}

export interface SubjectSummary {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly isActive: boolean;
}

export interface ClassOption {
  readonly id: string;
  readonly name: string;
}

export interface StaffAssignmentSummary {
  readonly id: string;
  readonly classId: string | null;
  readonly className: string | null;
  readonly subjectId: string | null;
  readonly subjectName: string | null;
}

export interface StaffMemberSummary {
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string | null;
  readonly role: string;
  readonly status: string;
  readonly assignments: readonly StaffAssignmentSummary[];
}

// ---------------------------------------------------------------------------
// Academics: events, exam schedules, timetable slots
// ---------------------------------------------------------------------------

export interface AcademicEventSummary {
  readonly id: string;
  readonly termId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly eventType: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface ExamScheduleSummary {
  readonly id: string;
  readonly termId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: string;
}

export interface ExamTimetableSlotSummary {
  readonly id: string;
  readonly examScheduleId: string;
  readonly subjectId: string;
  readonly subjectName: string | null;
  readonly classId: string;
  readonly className: string | null;
  readonly examDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly roomName: string | null;
  readonly supervisorId: string | null;
}

export interface ExamScheduleSummary {
  readonly id: string;
  readonly termId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: string;
}

export interface ExamTimetableSlotSummary {
  readonly id: string;
  readonly examScheduleId: string;
  readonly subjectId: string;
  readonly subjectName: string | null;
  readonly classId: string;
  readonly className: string | null;
  readonly examDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly roomName: string | null;
  readonly supervisorId: string | null;
}
