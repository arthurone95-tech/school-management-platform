/**
 * Shared view types for class attendance (docs/DECISIONS.md D-030).
 *
 * Isomorphic (no database imports) so the server operations and the browser
 * client speak the same shapes, as in the Phase 3 administration areas.
 *
 * Least privilege note: a teacher sees the classes they are assigned to and
 * their own subjects within them. No learner personal data other than the
 * learner's id, registration number and name (needed to mark a register) is
 * exposed anywhere in these types.
 */

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceClassOption {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface AttendanceSubjectOption {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
}

export interface AttendanceSessionSummary {
  readonly id: string;
  readonly classId: string;
  readonly className: string;
  readonly subjectId: string | null;
  readonly subjectName: string | null;
  readonly sessionDate: string;
  readonly notes: string | null;
  readonly recordedCount: number;
  /** False when the caller may no longer correct it (a teacher's session older than today). */
  readonly isCorrectable: boolean;
}

export interface AttendanceRosterEntry {
  readonly learnerId: string;
  readonly registrationNumber: string;
  readonly fullName: string;
  /** Null until the register is submitted for this learner. */
  readonly status: AttendanceStatus | null;
  readonly note: string | null;
}

export interface AttendanceSessionDetail {
  readonly session: AttendanceSessionSummary;
  readonly roster: readonly AttendanceRosterEntry[];
}

export interface AttendanceStatusCount {
  readonly status: AttendanceStatus;
  readonly count: number;
}

export interface AttendanceLearnerRow {
  readonly learnerId: string;
  readonly registrationNumber: string;
  readonly fullName: string;
  readonly present: number;
  readonly absent: number;
  readonly late: number;
  readonly excused: number;
  readonly sessionsRecorded: number;
}

export interface AttendanceClassReport {
  readonly classId: string;
  readonly className: string;
  readonly from: string;
  readonly to: string;
  readonly sessionCount: number;
  readonly totals: readonly AttendanceStatusCount[];
  readonly learners: readonly AttendanceLearnerRow[];
}
