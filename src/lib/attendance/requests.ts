/**
 * Request parsing and validation for the attendance endpoints
 * (docs/DECISIONS.md D-030).
 *
 * Pure and isomorphic (no Node-only or database imports) so the rules are
 * unit-tested without a database. These helpers only decide whether a request
 * is well formed; authentication, school membership, the permission check and
 * the correction window are enforced in trusted server code, and Row Level
 * Security remains the database-level boundary (docs/AGENTS.md 5).
 *
 * Two rules belong here because they must be identical for every caller and
 * cannot be left to a form:
 *
 *   * a session date may not be in the future (an attendance record for a day
 *     that has not happened would corrupt every report), and
 *   * a bulk register submission carries each learner at most once, so a
 *     repeated learner id is rejected rather than silently collapsed.
 */

import { daysBetween, isIsoDate } from "@/lib/dates";

import type { AttendanceStatus } from "./types";

/** The permitted statuses (D-030). */
export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "excused",
] as const;

/** Human labels, used by the client and by server-side messages. */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

/** Longest session or record note accepted (matches migration 0006). */
export const ATTENDANCE_NOTE_MAX_LENGTH = 200;

/**
 * Upper bound on learners in one register submission. A school class larger than
 * this needs a paged register, which is a later slice (docs/AGENTS.md 6).
 */
export const ATTENDANCE_MAX_RECORDS = 200;

/** Longest attendance report window accepted, so a query stays bounded. */
export const ATTENDANCE_MAX_REPORT_DAYS = 366;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/** The subset of `URLSearchParams` these parsers read, so they stay testable. */
export interface QueryReader {
  get(name: string): string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function readString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" ? value : null;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Reads a uuid field, returning a failure message when it is malformed. */
function uuidField(
  body: Record<string, unknown>,
  key: string,
  message: string,
): ParseResult<string> {
  const raw = readString(body, key);
  if (raw === null || !isUuid(raw.trim())) {
    return { ok: false, message };
  }
  return { ok: true, value: raw.trim() };
}

/** Reads an optional uuid field: absent or empty becomes `null`. */
function optionalUuidField(
  body: Record<string, unknown>,
  key: string,
  message: string,
): ParseResult<string | null> {
  if (!has(body, key)) {
    return { ok: true, value: null };
  }
  const raw = readString(body, key);
  if (raw === null) {
    return { ok: true, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (!isUuid(trimmed)) {
    return { ok: false, message };
  }
  return { ok: true, value: trimmed };
}

/** Reads an optional note: absent or empty becomes `null`. */
function noteField(
  body: Record<string, unknown>,
  key: string,
): ParseResult<string | null> {
  if (!has(body, key)) {
    return { ok: true, value: null };
  }
  const raw = readString(body, key);
  if (raw === null) {
    return { ok: true, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > ATTENDANCE_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      message: `A note can be at most ${ATTENDANCE_NOTE_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface SessionCreateInput {
  readonly classId: string;
  readonly subjectId: string | null;
  readonly sessionDate: string;
  readonly notes: string | null;
}

/**
 * Parses a new attendance session. `today` is injected by the caller so the
 * future-date rule is deterministic under test.
 */
export function parseSessionCreateInput(
  body: unknown,
  today: string,
): ParseResult<SessionCreateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const classId = uuidField(body, "classId", "Choose a class.");
  if (!classId.ok) {
    return classId;
  }

  const subjectId = optionalUuidField(body, "subjectId", "Invalid subject.");
  if (!subjectId.ok) {
    return subjectId;
  }

  const rawDate = readString(body, "sessionDate");
  if (rawDate === null || !isIsoDate(rawDate.trim())) {
    return { ok: false, message: "Choose a valid date (YYYY-MM-DD)." };
  }
  const sessionDate = rawDate.trim();
  if (sessionDate > today) {
    return {
      ok: false,
      message: "Attendance cannot be recorded for a future date.",
    };
  }

  const notes = noteField(body, "notes");
  if (!notes.ok) {
    return notes;
  }

  return {
    ok: true,
    value: {
      classId: classId.value,
      subjectId: subjectId.value,
      sessionDate,
      notes: notes.value,
    },
  };
}

export interface SessionListQuery {
  readonly sessionDate: string;
  readonly classId: string | null;
}

/** Parses the session list filter. An absent date means today. */
export function parseSessionListQuery(
  query: QueryReader,
  today: string,
): ParseResult<SessionListQuery> {
  // The class is validated before the date, because an absent date is legal
  // (it means today) and must not short-circuit the class check.
  const rawClass = query.get("classId");
  if (
    rawClass !== null &&
    rawClass.trim().length > 0 &&
    !isUuid(rawClass.trim())
  ) {
    return { ok: false, message: "Choose a valid class." };
  }
  const classId =
    rawClass === null || rawClass.trim().length === 0 ? null : rawClass.trim();

  const rawDate = query.get("date");
  if (rawDate === null || rawDate.trim().length === 0) {
    return { ok: true, value: { sessionDate: today, classId } };
  }
  const sessionDate = rawDate.trim();
  if (!isIsoDate(sessionDate)) {
    return { ok: false, message: "Choose a valid date (YYYY-MM-DD)." };
  }

  return { ok: true, value: { sessionDate, classId } };
}

// ---------------------------------------------------------------------------
// Register submission
// ---------------------------------------------------------------------------

export interface RegisterEntryInput {
  readonly learnerId: string;
  readonly status: AttendanceStatus;
  readonly note: string | null;
}

export interface RegisterSubmitInput {
  readonly sessionId: string;
  readonly entries: readonly RegisterEntryInput[];
}

/**
 * Parses a whole-register submission.
 *
 * Every learner must appear exactly once. Requiring the full register (rather
 * than a partial patch) means a save is atomic from the teacher's point of view
 * and a partially submitted register is never mistaken for a complete one; the
 * route checks the submitted learners against the current roster and refuses
 * anything missing.
 */
export function parseRegisterSubmitInput(
  body: unknown,
): ParseResult<RegisterSubmitInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const sessionId = uuidField(body, "sessionId", "Invalid request body.");
  if (!sessionId.ok) {
    return sessionId;
  }

  const rawEntries = body["entries"];
  if (!Array.isArray(rawEntries)) {
    return { ok: false, message: "Submit the class register." };
  }
  if (rawEntries.length === 0) {
    return { ok: false, message: "Mark at least one learner." };
  }
  if (rawEntries.length > ATTENDANCE_MAX_RECORDS) {
    return {
      ok: false,
      message: `A register can hold at most ${ATTENDANCE_MAX_RECORDS} learners.`,
    };
  }

  const seen = new Set<string>();
  const entries: RegisterEntryInput[] = [];

  for (const raw of rawEntries) {
    if (!isRecord(raw)) {
      return { ok: false, message: "Invalid register entry." };
    }

    const learnerId = uuidField(raw, "learnerId", "Invalid register entry.");
    if (!learnerId.ok) {
      return learnerId;
    }
    if (seen.has(learnerId.value)) {
      return {
        ok: false,
        message: "Each learner can appear only once in a register.",
      };
    }
    seen.add(learnerId.value);

    const rawStatus = readString(raw, "status");
    if (
      rawStatus === null ||
      !(ATTENDANCE_STATUSES as readonly string[]).includes(rawStatus)
    ) {
      return { ok: false, message: "Choose a valid attendance status." };
    }

    const note = noteField(raw, "note");
    if (!note.ok) {
      return note;
    }

    entries.push({
      learnerId: learnerId.value,
      status: rawStatus as AttendanceStatus,
      note: note.value,
    });
  }

  return { ok: true, value: { sessionId: sessionId.value, entries } };
}

// ---------------------------------------------------------------------------
// Class report
// ---------------------------------------------------------------------------

export interface ReportQuery {
  readonly classId: string;
  readonly from: string;
  readonly to: string;
}

/**
 * Parses the per-class report filter.
 *
 * `classId` is required and the window is bounded, because an unbounded
 * attendance aggregation over a whole school is exactly the query
 * docs/AGENTS.md 6 tells us not to allow. An absent window means today, which
 * keeps the endpoint usable with no parameters at all.
 */
export function parseReportQuery(
  query: QueryReader,
  today: string,
): ParseResult<ReportQuery> {
  const rawClass = query.get("classId");
  if (rawClass === null || !isUuid(rawClass.trim())) {
    return { ok: false, message: "Choose a class." };
  }

  const from = readDate(query, "from", today);
  if (!from.ok) {
    return from;
  }
  const to = readDate(query, "to", from.value);
  if (!to.ok) {
    return to;
  }
  if (to.value < from.value) {
    return {
      ok: false,
      message: "The end date must be on or after the start date.",
    };
  }
  if (daysBetween(from.value, to.value) >= ATTENDANCE_MAX_REPORT_DAYS) {
    return {
      ok: false,
      message: `Choose a window of at most ${ATTENDANCE_MAX_REPORT_DAYS} days.`,
    };
  }

  return {
    ok: true,
    value: { classId: rawClass.trim(), from: from.value, to: to.value },
  };
}

/**
 * Reads a date parameter. Absent or blank falls back to `fallback`, which is
 * `today` for the start of the window and the start date for its end, so a
 * caller who supplies only `from` gets a single-day report.
 */
function readDate(
  query: QueryReader,
  key: string,
  fallback: string,
): ParseResult<string> {
  const raw = query.get(key);
  if (raw === null || raw.trim().length === 0) {
    return { ok: true, value: fallback };
  }
  const value = raw.trim();
  if (!isIsoDate(value)) {
    return { ok: false, message: "Choose a valid date (YYYY-MM-DD)." };
  }
  return { ok: true, value };
}
