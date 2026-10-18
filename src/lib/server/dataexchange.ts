import "server-only";

import { parseCsv, toCsv, type CsvTable } from "@/lib/dataexchange/csv";
import {
  IMPORT_MAX_ROWS,
  parseLearnerImport,
  type ImportRowIssue,
} from "@/lib/dataexchange/learner-import";
import { enrolLearner } from "@/lib/server/enrolment";
import type { ParseResult } from "@/lib/dataexchange/csv";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Trusted bulk import and export operations (docs/DECISIONS.md D-032).
 *
 * Both directions run on the caller's **session** client, as in every other write
 * (D-018, D-027 to D-031). That is what makes this slice small: a bulk enrolment
 * is the same `learners` + `learner_class_placements` inserts the single-student
 * flow already performs, through the same `enrolLearner` operation, so Row Level
 * Security, the composite foreign keys and the uniqueness constraints all apply
 * unchanged and no new data path exists.
 *
 * Export is a read on the same client, bounded in rows, and **audited by the
 * database** through `record_data_export`, so the actor cannot be omitted or
 * supplied by the caller.
 */

export interface ExportResult {
  readonly ok: true;
  readonly csv: string;
  readonly rowCount: number;
  readonly filename: string;
}

export interface ExportFailure {
  readonly ok: false;
  readonly message: string;
}

/** Refuses an unbounded export. */
export const EXPORT_MAX_ROWS = 5000;

const LEARNER_EXPORT_HEADER = [
  "registration_number",
  "first_name",
  "last_name",
  "gender",
  "date_of_birth",
  "residential_address",
  "guardian_phone",
  "guardian_email",
  "username",
  "portal_access_state",
  "status",
  "class_name",
] as const;

/**
 * Every learner in the caller's school, as CSV.
 *
 * Includes the address and guardian contact, because an administrator exporting
 * their roll needs it to run the school — which is exactly why the endpoint
 * requires `learner.export` rather than `learner.read`, and why the export is
 * recorded in the audit trail.
 */
export async function exportLearners(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
}): Promise<ExportResult | ExportFailure> {
  const { supabase, schoolId } = input;

  const { data, error } = await supabase
    .from("learners")
    .select(
      "registration_number, first_name, last_name, gender, date_of_birth, " +
        "residential_address, guardian_phone, guardian_email, username, " +
        "portal_access_state, status, " +
        "learner_class_placements ( ended_at, classes ( name ) )",
    )
    .eq("school_id", schoolId)
    .order("registration_number")
    .limit(EXPORT_MAX_ROWS + 1);

  if (error || !data) {
    return { ok: false, message: "The learners could not be exported." };
  }

  if (data.length > EXPORT_MAX_ROWS) {
    return {
      ok: false,
      message:
        "This school has more learners than one export can hold. Narrow the export or raise the limit with a review.",
    };
  }

  const rows = data.map((row) => {
    const learner = row as unknown as {
      registration_number: string;
      first_name: string;
      last_name: string;
      gender: string;
      date_of_birth: string;
      residential_address: string;
      guardian_phone: string;
      guardian_email: string | null;
      username: string;
      portal_access_state: string;
      status: string;
      learner_class_placements:
        | { ended_at: string | null; classes: { name: string }[] | null }[]
        | null;
    };

    // The current placement is the one with no end date; a historical placement
    // is not what an export of the present roll should show.
    const current = (learner.learner_class_placements ?? []).find(
      (placement) => placement.ended_at === null,
    );

    return [
      learner.registration_number,
      learner.first_name,
      learner.last_name,
      learner.gender,
      learner.date_of_birth,
      learner.residential_address,
      learner.guardian_phone,
      learner.guardian_email ?? "",
      learner.username,
      learner.portal_access_state,
      learner.status,
      current?.classes?.[0]?.name ?? "",
    ];
  });

  await recordExport(supabase, "learners", rows.length);

  return {
    ok: true,
    csv: toCsv({ header: LEARNER_EXPORT_HEADER, rows }),
    rowCount: rows.length,
    filename: "learners.csv",
  };
}

/** One class's attendance over a window, as CSV. */
export async function exportClassAttendance(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly from: string;
  readonly to: string;
}): Promise<ExportResult | ExportFailure> {
  const { supabase, schoolId, classId, from, to } = input;

  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(
      "id, session_date, subject_id, notes, " +
        "classes ( name ), subjects ( name ), " +
        "attendance_records ( learner_id, status, " +
        "learners ( registration_number, first_name, last_name ) )",
    )
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .gte("session_date", from)
    .lte("session_date", to)
    .order("session_date")
    .limit(EXPORT_MAX_ROWS + 1);

  if (error || !data) {
    return { ok: false, message: "The attendance could not be exported." };
  }
  if (data.length > EXPORT_MAX_ROWS) {
    return {
      ok: false,
      message: "That class has more registers than one export can hold.",
    };
  }

  const header = [
    "session_date",
    "class",
    "subject",
    "registration_number",
    "first_name",
    "last_name",
    "status",
    "session_notes",
  ];

  const rows: string[][] = [];
  for (const raw of data) {
    const session = raw as unknown as {
      session_date: string;
      notes: string | null;
      classes: { name: string }[] | null;
      subjects: { name: string }[] | null;
      attendance_records:
        | {
            status: string;
            learners: {
              registration_number: string;
              first_name: string;
              last_name: string;
            }[];
          }[]
        | null;
    };

    for (const record of session.attendance_records ?? []) {
      const learner = record.learners?.[0];
      if (!learner) {
        continue;
      }
      rows.push([
        session.session_date,
        session.classes?.[0]?.name ?? "",
        session.subjects?.[0]?.name ?? "",
        learner.registration_number,
        learner.first_name,
        learner.last_name,
        record.status,
        session.notes ?? "",
      ]);
    }
  }

  await recordExport(supabase, "class_attendance", rows.length);

  return {
    ok: true,
    csv: toCsv({ header, rows }),
    rowCount: rows.length,
    filename: `attendance-${from}-to-${to}.csv`,
  };
}

/** One class's results over a window, as CSV. */
export async function exportClassResults(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly from: string;
  readonly to: string;
}): Promise<ExportResult | ExportFailure> {
  const { supabase, schoolId, classId, from, to } = input;

  const { data, error } = await supabase
    .from("assessments")
    .select(
      "name, max_score, assessed_on, " +
        "classes ( name ), subjects ( name ), " +
        "assessment_results ( score, " +
        "learners ( registration_number, first_name, last_name ) )",
    )
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("is_active", true)
    .gte("assessed_on", from)
    .lte("assessed_on", to)
    .order("assessed_on")
    .limit(EXPORT_MAX_ROWS + 1);

  if (error || !data) {
    return { ok: false, message: "The results could not be exported." };
  }
  if (data.length > EXPORT_MAX_ROWS) {
    return {
      ok: false,
      message: "That class has more assessments than one export can hold.",
    };
  }

  const header = [
    "assessed_on",
    "class",
    "subject",
    "assessment",
    "registration_number",
    "first_name",
    "last_name",
    "score",
    "max_score",
    "percentage",
  ];

  const rows: string[][] = [];
  for (const raw of data) {
    const assessment = raw as unknown as {
      name: string;
      max_score: number;
      assessed_on: string;
      classes: { name: string }[] | null;
      subjects: { name: string }[] | null;
      assessment_results:
        | {
            score: number | null;
            learners: {
              registration_number: string;
              first_name: string;
              last_name: string;
            }[];
          }[]
        | null;
    };
    const max = Number(assessment.max_score);

    for (const result of assessment.assessment_results ?? []) {
      const learner = result.learners?.[0];
      if (!learner) {
        continue;
      }
      rows.push([
        assessment.assessed_on,
        assessment.classes?.[0]?.name ?? "",
        assessment.subjects?.[0]?.name ?? "",
        assessment.name,
        learner.registration_number,
        learner.first_name,
        learner.last_name,
        result.score === null ? "" : String(result.score),
        String(max),
        result.score === null
          ? ""
          : String(Math.round((Number(result.score) / max) * 10000) / 100),
      ]);
    }
  }

  await recordExport(supabase, "class_results", rows.length);

  return {
    ok: true,
    csv: toCsv({ header, rows }),
    rowCount: rows.length,
    filename: `results-${from}-to-${to}.csv`,
  };
}

/**
 * Records the export in the audit trail.
 *
 * Best effort by design: the export has already been produced and the caller is
 * entitled to it, so an audit-write failure must not destroy the response. A
 * failure here means the database rejected the audit row — for example because
 * the caller has no active membership — which the permission check upstream
 * should already have excluded.
 */
async function recordExport(
  supabase: ServerClient,
  kind: string,
  rowCount: number,
): Promise<void> {
  try {
    await supabase.rpc("record_data_export", {
      export_kind: kind,
      row_count: rowCount,
    });
  } catch {
    // Deliberately not surfaced to the caller; see the note above.
  }
}

export interface ImportRowResult {
  readonly row: number;
  readonly registrationNumber: string | null;
  readonly learnerId: string | null;
  readonly created: boolean;
  readonly message: string | null;
}

export interface ImportRunResult {
  readonly created: number;
  readonly completedPlacement: number;
  readonly failed: number;
  readonly results: readonly ImportRowResult[];
  readonly issues: readonly ImportRowIssue[];
  readonly ignoredColumns: readonly string[];
}

export type ImportOutcome =
  | { readonly ok: true; readonly result: ImportRunResult }
  | { readonly ok: false; readonly message: string };

/**
 * Imports a learner's class list.
 *
 * Every row is validated by the enrolment parser and then written by
 * `enrolLearner` on the caller's session client, so a bulk row is held to exactly
 * the same rules as a typed one. A row that fails is reported and the rest
 * continue: a school fixing forty typos one request at a time is not workable,
 * and a partial import that stopped at the first bad line would be worse.
 */
export async function importLearners(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly userId: string;
  readonly csv: string;
}): Promise<ImportOutcome> {
  const { supabase, schoolId, userId, csv } = input;

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, is_active")
    .eq("school_id", schoolId);

  if (classesError || !classes) {
    return { ok: false, message: "The class list could not be loaded." };
  }

  const byName = new Map<string, string>();
  for (const klass of classes as {
    id: string;
    name: string;
    is_active: boolean;
  }[]) {
    if (klass.is_active) {
      // A spreadsheet is typed by hand, so the match is trimmed and
      // case-insensitive; the stored name keeps its own capitalisation.
      byName.set(klass.name.trim().toLowerCase(), klass.id);
    }
  }

  const table = csvTable(csv);
  if (!table.ok) {
    return { ok: false, message: table.message };
  }

  const parsed = parseLearnerImport({
    table: table.value,
    classNameToId: (name) => byName.get(name.trim().toLowerCase()) ?? null,
  });

  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }

  if (parsed.value.rows.length > IMPORT_MAX_ROWS) {
    return {
      ok: false,
      message: `This file has ${parsed.value.rows.length} usable rows. Import at most ${IMPORT_MAX_ROWS} at a time.`,
    };
  }

  const results: ImportRowResult[] = [];
  let created = 0;
  let completedPlacement = 0;

  for (const row of parsed.value.rows) {
    const outcome = await enrolLearner({
      supabase,
      schoolId,
      userId,
      input: row.input,
    });

    if (outcome.ok) {
      created += 1;
      if (outcome.completedExisting) {
        completedPlacement += 1;
      }
      results.push({
        row: row.row,
        registrationNumber: row.registrationNumber,
        learnerId: outcome.learner.id,
        created: true,
        message: outcome.completedExisting
          ? "Placed an existing learner who had no class."
          : null,
      });
      continue;
    }

    results.push({
      row: row.row,
      registrationNumber: row.registrationNumber,
      learnerId: null,
      created: false,
      message: outcome.message,
    });
  }

  return {
    ok: true,
    result: {
      created,
      completedPlacement,
      failed:
        parsed.value.issues.length +
        results.filter((entry) => !entry.created).length,
      results,
      issues: parsed.value.issues,
      ignoredColumns: parsed.value.ignoredColumns,
    },
  };
}

/**
 * Parses the CSV, or returns the parser's message so the caller reports it
 * instead of crashing on a file the user can fix.
 */
function csvTable(csv: string): ParseResult<CsvTable> {
  return parseCsv(csv);
}
