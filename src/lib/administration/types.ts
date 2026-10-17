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
}

export interface TermSummary {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface AcademicYearSummary {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
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
