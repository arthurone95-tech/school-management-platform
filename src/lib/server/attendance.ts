import "server-only";

import type {
  AttendanceClassOption,
  AttendanceClassReport,
  AttendanceRosterEntry,
  AttendanceSessionDetail,
  AttendanceSessionSummary,
  AttendanceStatus,
  AttendanceSubjectOption,
} from "@/lib/attendance/types";
import { ATTENDANCE_STATUSES } from "@/lib/attendance/requests";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Trusted attendance operations (docs/DECISIONS.md D-030).
 *
 * Every read and write runs on the caller's *session* client, exactly like the
 * enrolment and administration operations (D-018, D-028, D-029). The school id is
 * resolved from the caller's own membership before these are called, so Row
 * Level Security — not this module — is the enforcement boundary.
 *
 * The two rules that RLS cannot express live here, in trusted server code:
 *
 *   * **Teacher class scope.** `can_access_class` (migration 0006) restricts a
 *     teacher to the classes they are assigned to. A write for any other class
 *     is refused by the policy, so a `404` here means "no such session *for
 *     you*" and never reveals another school's or another class's data.
 *   * **The correction window.** A teacher may correct a register while the
 *     session date is still today; an administrator may correct any time
 *     (`attendance.report`). This is a business rule, not an access rule, so it
 *     is checked explicitly and returned as a typed reason.
 *
 * Nothing here deletes. A register is corrected by writing the full register
 * again, which upserts by `(session_id, learner_id)`.
 */

export type FailureReason = "not_found" | "duplicate" | "invalid" | "other";

/** Why a correction was refused. Distinct from `invalid`, which is a bad request. */
export type CorrectionRefusal = "closed_for_teacher";

/** Every reason a write can fail, mapped onto a status code by each route. */
export type WriteReason = FailureReason | CorrectionRefusal;

export interface WriteFailure {
  readonly ok: false;
  readonly reason: WriteReason;
  readonly message: string;
}

/** Maps a PostgreSQL error code onto a caller-facing reason. */
function classify(error: unknown): FailureReason {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "23505":
      return "duplicate";
    case "23514":
    case "23503":
      return "invalid";
    default:
      return "other";
  }
}

function failureMessage(reason: FailureReason, subject: string): string {
  switch (reason) {
    case "duplicate":
      return `That ${subject.toLowerCase()} already exists.`;
    case "invalid":
      return `That ${subject.toLowerCase()} is not valid.`;
    case "not_found":
      return `The ${subject.toLowerCase()} could not be found.`;
    default:
      return `The ${subject.toLowerCase()} could not be saved.`;
  }
}

// ---------------------------------------------------------------------------
// Lookup options (class and subject pickers)
// ---------------------------------------------------------------------------

/**
 * The classes the caller may take attendance for, read through
 * `accessible_classes` (migration 0007).
 *
 * That function is needed because a teacher deliberately holds no `class.read`
 * (D-030): the only classes they learn about are the ones they are assigned to.
 * The function is `SECURITY DEFINER` and gated, so calling it cannot widen
 * access; it returns class names only, never learner data.
 */
export async function listAttendanceClasses(
  supabase: ServerClient,
  schoolId: string,
): Promise<AttendanceClassOption[] | null> {
  const { data, error } = await supabase.rpc("accessible_classes", {
    target_school_id: schoolId,
  });

  if (error || !data) {
    return null;
  }
  return (
    data as { class_id: string; class_name: string; is_active: boolean }[]
  )
    .map((row) => ({
      id: row.class_id,
      name: row.class_name,
      isActive: row.is_active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The active subjects the caller may use in one class, through `class_subjects`
 * (migration 0007). A teacher sees their own subjects in their own class; an
 * administrator sees every active subject.
 */
export async function listClassSubjects(
  supabase: ServerClient,
  schoolId: string,
  classId: string,
): Promise<AttendanceSubjectOption[] | null> {
  const { data, error } = await supabase.rpc("class_subjects", {
    target_school_id: schoolId,
    target_class_id: classId,
  });

  if (error || !data) {
    return null;
  }
  return (
    data as {
      subject_id: string;
      subject_name: string;
      subject_code: string | null;
    }[]
  ).map((row) => ({
    id: row.subject_id,
    name: row.subject_name,
    code: row.subject_code,
  }));
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * One row as PostgREST returns it. The embedded `classes`/`subjects` come back
 * as arrays even though each is a many-to-one embed, so the shape is read as an
 * array and the first element (or none) is used.
 */
interface SessionRow {
  readonly id: string;
  readonly class_id: string;
  readonly subject_id: string | null;
  readonly session_date: string;
  readonly notes: string | null;
  readonly classes: { readonly name: string }[] | null;
  readonly subjects: { readonly name: string }[] | null;
}

const SESSION_SELECT =
  "id, class_id, subject_id, session_date, notes, classes ( name ), subjects ( name )";

function toSessionSummary(
  row: SessionRow,
  isCorrectable: boolean,
  recordedCount: number,
): AttendanceSessionSummary {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.classes?.[0]?.name ?? "",
    subjectId: row.subject_id,
    subjectName: row.subjects?.[0]?.name ?? null,
    sessionDate: row.session_date,
    notes: row.notes,
    recordedCount,
    isCorrectable,
  };
}

/**
 * Lists sessions on a date, newest-subject-first, with the number of learners
 * already marked. RLS limits the result to the caller's classes.
 */
export async function listSessions(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly sessionDate: string;
  readonly classId: string | null;
  readonly canCorrectAnyDate: boolean;
  readonly today: string;
}): Promise<AttendanceSessionSummary[] | null> {
  const { supabase, schoolId, sessionDate, classId } = input;

  let query = supabase
    .from("attendance_sessions")
    .select(SESSION_SELECT)
    .eq("school_id", schoolId)
    .eq("session_date", sessionDate);

  if (classId !== null) {
    query = query.eq("class_id", classId);
  }

  const { data, error } = await query.order("id");

  if (error || !data) {
    return null;
  }

  const rows = data as SessionRow[];
  const counts = await countRecordsPerSession(supabase, schoolId, rows);

  // Every session in this list shares the requested date, so correctability is
  // a single comparison rather than per row.
  const isCorrectable = input.canCorrectAnyDate || sessionDate === input.today;

  return rows.map((row) =>
    toSessionSummary(row, isCorrectable, counts.get(row.id) ?? 0),
  );
}

/** Counts records per session in one round trip rather than one query per row. */
async function countRecordsPerSession(
  supabase: ServerClient,
  schoolId: string,
  rows: readonly SessionRow[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (rows.length === 0) {
    return counts;
  }

  const sessionIds = rows.map((row) => row.id);
  const { data } = await supabase
    .from("attendance_records")
    .select("session_id")
    .eq("school_id", schoolId)
    .in("session_id", sessionIds);

  for (const row of (data ?? []) as { session_id: string }[]) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }
  return counts;
}

/** A corrected session is read back rather than rebuilt from the request. */
export type SessionResult =
  | { readonly ok: true; readonly session: AttendanceSessionSummary }
  | WriteFailure;

/**
 * Creates a session and returns it, or `not_found` when the class is not one the
 * caller may attend (an unassigned class for a teacher, another school's class
 * for anybody). The composite foreign key also rejects a cross-school id, and
 * the unique index rejects a second session for the same class, date and
 * subject.
 */
export async function createSession(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly subjectId: string | null;
  readonly sessionDate: string;
  readonly notes: string | null;
  readonly canCorrectAnyDate: boolean;
  readonly today: string;
}): Promise<SessionResult> {
  const { data, error } = await input.supabase
    .from("attendance_sessions")
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      subject_id: input.subjectId,
      session_date: input.sessionDate,
      notes: input.notes,
    })
    .select(SESSION_SELECT)
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    // A policy refusal and a missing class are deliberately indistinguishable:
    // the caller learns that they may not create this session, not why.
    if (reason === "other" && isPolicyRefusal(error)) {
      return {
        ok: false,
        reason: "not_found",
        message: failureMessage("not_found", "Class"),
      };
    }
    if (reason === "duplicate") {
      return {
        ok: false,
        reason: "duplicate",
        message:
          "Attendance for that class and subject has already been recorded on this date.",
      };
    }
    return { ok: false, reason, message: failureMessage(reason, "Session") };
  }

  const row = data as SessionRow;
  return {
    ok: true,
    session: toSessionSummary(
      row,
      input.canCorrectAnyDate || input.sessionDate === input.today,
      0,
    ),
  };
}

/** RLS refusals surface as `42501` (insufficient_privilege). */
function isPolicyRefusal(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42501" || code === "PGRST301";
}

// ---------------------------------------------------------------------------
// Register (roster and records)
// ---------------------------------------------------------------------------

export type RegisterResult =
  | { readonly ok: true; readonly detail: AttendanceSessionDetail }
  | WriteFailure;

/**
 * The register for one session: the current class roster from `class_roster`
 * (migration 0006), merged with whatever has already been recorded.
 *
 * The roster function is what lets a teacher mark a register without holding
 * `learner.read`: it returns only id, registration number and name for learners
 * currently placed in a class they can access.
 */
export async function getRegister(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly sessionId: string;
  readonly canCorrectAnyDate: boolean;
  readonly today: string;
}): Promise<RegisterResult> {
  const { supabase, schoolId, sessionId } = input;

  const { data: sessionData, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (sessionError) {
    return {
      ok: false,
      reason: "other",
      message: "The register could not be loaded.",
    };
  }
  if (!sessionData) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Session"),
    };
  }

  const session = sessionData as SessionRow;

  const [{ data: rosterData, error: rosterError }, { data: recordData }] =
    await Promise.all([
      supabase.rpc("class_roster", {
        target_school_id: schoolId,
        target_class_id: session.class_id,
      }),
      supabase
        .from("attendance_records")
        .select("learner_id, status, note")
        .eq("school_id", schoolId)
        .eq("session_id", sessionId),
    ]);

  if (rosterError || !rosterData) {
    return {
      ok: false,
      reason: "other",
      message: "The register could not be loaded.",
    };
  }

  const recorded = new Map<
    string,
    { status: AttendanceStatus; note: string | null }
  >();
  for (const row of (recordData ?? []) as {
    learner_id: string;
    status: AttendanceStatus;
    note: string | null;
  }[]) {
    recorded.set(row.learner_id, { status: row.status, note: row.note });
  }

  const roster: AttendanceRosterEntry[] = (
    rosterData as {
      learner_id: string;
      registration_number: string;
      full_name: string;
    }[]
  ).map((row) => {
    const existing = recorded.get(row.learner_id);
    return {
      learnerId: row.learner_id,
      registrationNumber: row.registration_number,
      fullName: row.full_name,
      status: existing?.status ?? null,
      note: existing?.note ?? null,
    };
  });

  const isCorrectable =
    input.canCorrectAnyDate || session.session_date === input.today;

  return {
    ok: true,
    detail: {
      session: toSessionSummary(session, isCorrectable, recorded.size),
      roster,
    },
  };
}

export interface RegisterEntry {
  readonly learnerId: string;
  readonly status: AttendanceStatus;
  readonly note: string | null;
}

export type SubmitRegisterResult =
  | {
      readonly ok: true;
      readonly recorded: number;
      readonly detail: AttendanceSessionDetail;
    }
  | WriteFailure;

/**
 * Writes the whole register for a session.
 *
 * The register is submitted in full and every learner must be a current member
 * of the class: a partial write would leave a register that looks complete but is
 * not, and an unknown learner id would otherwise be an unaudited way to attach a
 * record to somebody who is not on the roll.
 *
 * Existing records are updated and new ones inserted, so a repeated submission
 * of unchanged marks writes nothing but still returns the register. Every write
 * runs on the caller's session client, so RLS decides whether the session is
 * theirs; a refusal is reported as `not_found` rather than leaking existence.
 */
export async function submitRegister(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly sessionId: string;
  readonly entries: readonly RegisterEntry[];
  readonly canCorrectAnyDate: boolean;
  readonly today: string;
}): Promise<SubmitRegisterResult> {
  const { supabase, schoolId, sessionId, entries } = input;

  const { data: sessionData, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id, class_id, session_date")
    .eq("id", sessionId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (sessionError) {
    return {
      ok: false,
      reason: "other",
      message: "The register could not be saved.",
    };
  }
  if (!sessionData) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Session"),
    };
  }

  const session = sessionData as {
    id: string;
    class_id: string;
    session_date: string;
  };

  // The correction window: a teacher may only correct today's register.
  if (!input.canCorrectAnyDate && session.session_date !== input.today) {
    return {
      ok: false,
      reason: "closed_for_teacher",
      message:
        "This register can no longer be changed by a teacher. Ask an administrator to correct it.",
    };
  }

  const { data: rosterData, error: rosterError } = await supabase.rpc(
    "class_roster",
    { target_school_id: schoolId, target_class_id: session.class_id },
  );

  if (rosterError || !rosterData) {
    return {
      ok: false,
      reason: "other",
      message: "The register could not be saved.",
    };
  }

  const rosterIds = new Set(
    (rosterData as { learner_id: string }[]).map((row) => row.learner_id),
  );

  const missing = entries.filter((entry) => !rosterIds.has(entry.learnerId));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "invalid",
      message:
        "The register must mark every learner currently in the class. Reload and try again.",
    };
  }

  const { data: existingData } = await supabase
    .from("attendance_records")
    .select("learner_id")
    .eq("school_id", schoolId)
    .eq("session_id", sessionId);

  const existingIds = new Set(
    (existingData ?? []).map(
      (row) => (row as { learner_id: string }).learner_id,
    ),
  );

  for (const entry of entries) {
    const row = {
      school_id: schoolId,
      session_id: sessionId,
      learner_id: entry.learnerId,
      status: entry.status,
      note: entry.note,
    };

    const result = existingIds.has(entry.learnerId)
      ? await supabase
          .from("attendance_records")
          .update({ status: entry.status, note: entry.note })
          .eq("school_id", schoolId)
          .eq("session_id", sessionId)
          .eq("learner_id", entry.learnerId)
      : await supabase.from("attendance_records").insert(row);

    if (result.error) {
      if (isPolicyRefusal(result.error)) {
        return {
          ok: false,
          reason: "not_found",
          message: failureMessage("not_found", "Session"),
        };
      }
      const reason = classify(result.error);
      return { ok: false, reason, message: failureMessage(reason, "Register") };
    }
  }

  const register = await getRegister({
    supabase,
    schoolId,
    sessionId,
    canCorrectAnyDate: input.canCorrectAnyDate,
    today: input.today,
  });

  if (!register.ok) {
    return register;
  }

  return {
    ok: true,
    recorded: entries.length,
    detail: register.detail,
  };
}

// ---------------------------------------------------------------------------
// Class report (attendance.report)
// ---------------------------------------------------------------------------

/**
 * Aggregates one class's attendance over a bounded window.
 *
 * Counts are computed from the rows the caller's session client can read, which
 * for `attendance.report` is every class in their school. A class outside that
 * scope yields nothing, so the report cannot disclose another school's data.
 * A learner who has since changed class still appears under the class the
 * attendance was taken in, which is what a register is a record of.
 */
export async function buildClassReport(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly from: string;
  readonly to: string;
}): Promise<AttendanceClassReport | null> {
  const { supabase, schoolId, classId, from, to } = input;

  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (classError) {
    return null;
  }
  if (!classData) {
    // The caller cannot see the class, or it does not exist. Either way there is
    // nothing to report, and the route turns this into a 404.
    return null;
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .gte("session_date", from)
    .lte("session_date", to);

  if (sessionError) {
    return null;
  }

  const sessionIds = ((sessionData ?? []) as { id: string }[]).map(
    (row) => row.id,
  );
  const sessionCount = sessionIds.length;

  const { data: rosterData } = await supabase.rpc("class_roster", {
    target_school_id: schoolId,
    target_class_id: classId,
  });

  const roster = (rosterData ?? []) as {
    learner_id: string;
    registration_number: string;
    full_name: string;
  }[];

  const totals: Record<AttendanceStatus, number> = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };

  const perLearner = new Map<
    string,
    { present: number; absent: number; late: number; excused: number }
  >();

  if (sessionIds.length > 0) {
    const { data: recordData, error: recordError } = await supabase
      .from("attendance_records")
      .select("learner_id, status")
      .eq("school_id", schoolId)
      .in("session_id", sessionIds);

    if (recordError) {
      return null;
    }

    for (const row of (recordData ?? []) as {
      learner_id: string;
      status: AttendanceStatus;
    }[]) {
      if (!(ATTENDANCE_STATUSES as readonly string[]).includes(row.status)) {
        continue;
      }
      const status = row.status as AttendanceStatus;
      totals[status] += 1;

      const counts = perLearner.get(row.learner_id) ?? {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
      counts[status] += 1;
      perLearner.set(row.learner_id, counts);
    }
  }

  return {
    classId,
    className: (classData as { name: string }).name,
    from,
    to,
    sessionCount,
    totals: ATTENDANCE_STATUSES.map((status) => ({
      status,
      count: totals[status],
    })),
    learners: roster.map((row) => {
      const counts = perLearner.get(row.learner_id) ?? {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
      return {
        learnerId: row.learner_id,
        registrationNumber: row.registration_number,
        fullName: row.full_name,
        present: counts.present,
        absent: counts.absent,
        late: counts.late,
        excused: counts.excused,
        sessionsRecorded:
          counts.present + counts.absent + counts.late + counts.excused,
      };
    }),
  };
}
