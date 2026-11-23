/**
 * Deterministic, presentation-only formatting for staff-facing screens.
 *
 * Timestamps are rendered in UTC with a fixed locale so the server and browser
 * produce identical text and do not cause a hydration mismatch. Ghana is UTC+0,
 * which also makes this the correct local presentation for the first market.
 * These helpers are pure and isomorphic; they never read the clock.
 */

export function formatDateTime(
  iso: string | null | undefined,
  fallback = "Not recorded",
): string {
  if (!iso) {
    return fallback;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export function formatCalendarDate(
  value: string | null | undefined,
  fallback = "Not recorded",
): string {
  if (!value) {
    return fallback;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Trims a numeric value to two decimal places without trailing zeros. */
export function formatMeasure(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return String(Math.round(value * 100) / 100);
}

const PORTAL_STATE_LABELS: Record<string, string> = {
  none: "No portal account",
  activation_pending: "Activation pending",
  active: "Active",
  suspended: "Suspended",
  revoked: "Revoked",
};

export function portalStateLabel(state: string): string {
  return PORTAL_STATE_LABELS[state] ?? state;
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Authorized absence",
};

export function attendanceStatusLabel(status: string): string {
  return ATTENDANCE_STATUS_LABELS[status] ?? status;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  insert: "Created",
  update: "Edited",
  delete: "Deleted",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const AUDIT_TABLE_LABELS: Record<string, string> = {
  academic_years: "Academic year",
  academic_events: "School event",
  assessment_components: "Assessment component",
  assessment_results: "Assessment result",
  assessments: "Assessment",
  classes: "Class",
  exam_schedules: "Examination schedule",
  exam_timetable_slots: "Examination slot",
  grade_bands: "Grade band",
  learner_class_placements: "Class placement",
  learners: "Student",
  school_members: "Staff membership",
  schools: "School",
  subjects: "Subject",
  terms: "Term",
};

export function auditTableLabel(table: string): string {
  return AUDIT_TABLE_LABELS[table] ?? table;
}
