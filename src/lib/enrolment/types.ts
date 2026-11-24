/**
 * Shared shapes for the enrolment feature.
 *
 * Kept free of `server-only` imports so the client components can import the
 * types without pulling in a database module (`src/lib/server/enrolment.ts`).
 */

export interface ClassSummary {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface LearnerSummary {
  readonly id: string;
  readonly username: string;
  readonly registrationNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly gender: string;
  readonly dateOfBirth: string;
  readonly status: string;
  readonly classId: string | null;
  readonly className: string | null;
}

/** One row of a student's class-placement history, newest first. */
export interface LearnerPlacementHistoryEntry {
  readonly classId: string;
  readonly className: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly isCurrent: boolean;
}

/** One bounded attendance record for a student, newest first. */
export interface LearnerAttendanceEntry {
  readonly sessionDate: string;
  readonly status: string;
  readonly subjectName: string | null;
  readonly note: string | null;
}

/** One recorded assessment mark for a student, newest first. */
export interface LearnerResultEntry {
  readonly assessmentName: string;
  readonly assessedOn: string;
  readonly subjectName: string | null;
  readonly score: number;
  readonly maxScore: number;
  readonly percentage: number;
  readonly remark: string | null;
}

/**
 * The full learner record for the profile and correction views. The extra
 * fields are fetched one learner at a time so the paged list does not disclose
 * every child's address, guardian contact details or academic history
 * (docs/SECURITY_AND_PRIVACY.md 4).
 */
export interface LearnerDetail extends LearnerSummary {
  readonly residentialAddress: string;
  readonly guardianPhone: string;
  readonly guardianEmail: string | null;
  readonly healthStatus: string | null;
  /** Server registration timestamp, which is distinct from the school year. */
  readonly createdAt: string;
  /** Enrolment-level portal state, deliberately separate from `status`. */
  readonly portalAccessState: string;
  /** Supabase Auth last sign-in, or null when the student has not signed in. */
  readonly lastSignInAt: string | null;
  readonly placementHistory: readonly LearnerPlacementHistoryEntry[];
  readonly attendanceHistory: readonly LearnerAttendanceEntry[];
  readonly results: readonly LearnerResultEntry[];
}

export interface LearnerPage {
  readonly learners: LearnerSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
