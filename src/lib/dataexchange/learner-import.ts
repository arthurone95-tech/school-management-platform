/**
 * Bulk import of an existing class list (D-032).
 *
 * The point of this slice is that a school arriving with 400 existing students
 * must not have to enrol them one at a time — that is the difference between the
 * product being adopted and not.
 *
 * Every row is validated by the **same** parser the single-student enrolment form
 * runs (`parseEnrolmentInput`), and each accepted row goes through the **same**
 * trusted operation (`enrolLearner`). Nothing here re-implements a rule, so a
 * bulk row can never be held to a different standard than a typed one, and the
 * database constraints apply exactly as they do for a single enrolment.
 *
 * Pure and isomorphic: this module decides what a row means, and the server
 * operation decides what happens to it.
 */

import {
  parseEnrolmentInput,
  type EnrolmentInput,
} from "@/lib/enrolment/requests";

import {
  mapColumns,
  readCell,
  type ColumnMapping,
  type CsvTable,
  type MapResult,
} from "./csv";

/**
 * Most rows accepted in one request.
 *
 * Each row is an insert plus a placement insert over PostgREST, so an unbounded
 * batch would hold an HTTP request open for minutes — the wrong behaviour on the
 * slow connections these schools have (docs/FEATURE_SPECIFICATIONS.md 8). A
 * school imports in batches and is told where to continue.
 */
export const IMPORT_MAX_ROWS = 100;

/** Columns a learner's class list must have. */
export const REQUIRED_COLUMNS = [
  "registration_number",
  "first_name",
  "last_name",
  "gender",
  "date_of_birth",
  "residential_address",
  "guardian_phone",
  "class_name",
] as const;

/** Columns that may be omitted; an absent column means "not supplied". */
export const OPTIONAL_COLUMNS = ["guardian_email"] as const;

export interface ImportRowIssue {
  /** 1-based row number as it appears in the file, including the header. */
  readonly row: number;
  readonly registrationNumber: string | null;
  readonly message: string;
}

export interface ParsedImportRow {
  readonly row: number;
  readonly registrationNumber: string | null;
  readonly input: EnrolmentInput;
}

export interface ParsedImport {
  readonly rows: readonly ParsedImportRow[];
  readonly issues: readonly ImportRowIssue[];
  /** Columns present in the file that the import ignores. */
  readonly ignoredColumns: readonly string[];
}

export type ImportParseResult =
  | { readonly ok: true; readonly value: ParsedImport }
  | { readonly ok: false; readonly message: string };

/**
 * Validates every row of a learner's class list.
 *
 * Rows are validated independently and a bad row does not stop the rest: a head
 * teacher fixing 40 typos one at a time is not workable, and the response tells
 * them exactly which line each problem is on. What this module will not do is
 * guess: a row missing a required value is an issue, not a silently blank
 * record.
 *
 * `classNameToId` resolves a class name to its id, returning `null` when the
 * school has no such active class — reported as an issue rather than creating a
 * learner in no class.
 */
export function parseLearnerImport(input: {
  readonly table: CsvTable;
  readonly classNameToId: (name: string) => string | null;
}): ImportParseResult {
  const mapping: MapResult<ColumnMapping> = mapColumns(
    input.table.header,
    REQUIRED_COLUMNS,
    OPTIONAL_COLUMNS,
  );

  if (!mapping.ok) {
    return mapping;
  }

  // Captured before the loop so the narrowing survives into the closure below.
  const columns: ColumnMapping = mapping.value;
  const rows: ParsedImportRow[] = [];
  const issues: ImportRowIssue[] = [];

  input.table.rows.forEach((row, offset) => {
    // +2 because the header is line 1 and the array is zero-based, so the first
    // data row is line 2 — the number the user sees in their spreadsheet.
    const lineNumber = offset + 2;
    const registrationNumber = readCell(row, columns, "registration_number");

    const className = readCell(row, columns, "class_name");
    const classId = className === null ? null : input.classNameToId(className);

    // The class is resolved before the rest of the row is validated, because an
    // unknown or blank class is the most common import problem and deserves its
    // own message. Running the enrolment parser first would report only the
    // generic "choose a class", naming neither the problem nor the class.
    if (classId === null) {
      issues.push({
        row: lineNumber,
        registrationNumber,
        message:
          className === null
            ? "The class is blank. Every learner needs a class."
            : `No active class named "${className}" exists in your school. Create it first, or use one of your existing class names exactly.`,
      });
      return;
    }

    const body: Record<string, unknown> = {
      registrationNumber: registrationNumber ?? "",
      firstName: readCell(row, columns, "first_name") ?? "",
      lastName: readCell(row, columns, "last_name") ?? "",
      gender: readCell(row, columns, "gender") ?? "",
      dateOfBirth: readCell(row, columns, "date_of_birth") ?? "",
      residentialAddress: readCell(row, columns, "residential_address") ?? "",
      guardianPhone: readCell(row, columns, "guardian_phone") ?? "",
      guardianEmail: readCell(row, columns, "guardian_email") ?? null,
      classId,
    };

    const parsed = parseEnrolmentInput(body);
    if (!parsed.ok) {
      issues.push({
        row: lineNumber,
        registrationNumber,
        message: parsed.message,
      });
      return;
    }

    rows.push({
      row: lineNumber,
      registrationNumber: parsed.value.registrationNumber,
      input: { ...parsed.value, classId },
    });
  });

  return {
    ok: true,
    value: {
      rows,
      issues,
      ignoredColumns: columns.unknown,
    },
  };
}

/** A template the interface offers for download, so the expected format is exact. */
export const IMPORT_TEMPLATE_HEADER = [
  "registration_number",
  "first_name",
  "last_name",
  "gender",
  "date_of_birth",
  "residential_address",
  "guardian_phone",
  "guardian_email",
  "class_name",
] as const;

/**
 * One illustrative example row, shown in the interface beside the template.
 *
 * The address deliberately has no comma. Real addresses do, and the interface
 * says so — a value containing a comma must be wrapped in double quotes — but
 * the example a user copies should be usable verbatim without that extra step.
 */
export const IMPORT_TEMPLATE_EXAMPLE = [
  "A-001",
  "Ama",
  "Bello",
  "female",
  "2016-05-04",
  "Plot 3 Nsawam",
  "0240000001",
  "",
  "Primary 1",
] as const;
