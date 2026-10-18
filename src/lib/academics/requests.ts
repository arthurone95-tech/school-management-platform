/**
 * Request parsing and validation for the assessment, result, grade-band and
 * academic-report endpoints (docs/DECISIONS.md D-031).
 *
 * Pure and isomorphic so the rules are unit-tested without a database. These
 * helpers only decide whether a request is well formed; authentication, school
 * membership, the permission check and class scoping happen in trusted server
 * code, and Row Level Security remains the database-level boundary
 * (docs/AGENTS.md 5).
 *
 * Two rules live here because they must be identical for every caller:
 *
 *   * a score may not exceed the assessment maximum (the database enforces this
 *     too, with a trigger, because the maximum lives in another table), and
 *   * grade bands may not overlap, so a percentage can never match two bands.
 */

import { isIsoDate } from "@/lib/dates";

import type { GradeBandSummary } from "./types";

/** Longest assessment name accepted (matches migration 0009). */
export const ASSESSMENT_NAME_MAX_LENGTH = 80;
/** Longest assessment note accepted (matches migration 0009). */
export const ASSESSMENT_NOTE_MAX_LENGTH = 200;
/** Longest grade band label accepted (matches migration 0009). */
export const GRADE_BAND_LABEL_MAX_LENGTH = 20;
/** Longest grade band remark accepted (matches migration 0009). */
export const GRADE_BAND_REMARK_MAX_LENGTH = 120;
/** Largest assessment maximum accepted, matching `numeric(7,2)`. */
export const ASSESSMENT_MAX_SCORE_LIMIT = 99_999.99;
/** Most learners in one mark submission. */
export const ASSESSMENT_MAX_ENTRIES = 200;
/** Days of assessments one report may span. */
export const ACADEMIC_MAX_REPORT_DAYS = 366;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

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

/** Reads an optional uuid field; absent or blank becomes `null`. */
function optionalUuidField(
  body: Record<string, unknown>,
  key: string,
  message: string,
): ParseResult<string | null> {
  if (!has(body, key)) {
    return { ok: true, value: null };
  }
  const raw = readString(body, key);
  if (raw === null || raw.trim().length === 0) {
    return { ok: true, value: null };
  }
  if (!isUuid(raw.trim())) {
    return { ok: false, message };
  }
  return { ok: true, value: raw.trim() };
}

function noteField(
  body: Record<string, unknown>,
  key: string,
  max: number,
  subject: string,
): ParseResult<string | null> {
  if (!has(body, key)) {
    return { ok: true, value: null };
  }
  const raw = readString(body, key);
  if (raw === null || raw.trim().length === 0) {
    return { ok: true, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length > max) {
    return {
      ok: false,
      message: `A ${subject} can be at most ${max} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

/** Reads a finite number, rejecting NaN, Infinity and non-numbers. */
function readNumber(
  body: Record<string, unknown>,
  key: string,
  message: string,
): ParseResult<number> {
  const raw = body[key];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, message };
  }
  return { ok: true, value: raw };
}

// ---------------------------------------------------------------------------
// Grade bands
// ---------------------------------------------------------------------------

export interface GradeBandInput {
  readonly minPercentage: number;
  readonly label: string;
  readonly remark: string | null;
  readonly isPassing: boolean;
}

export interface GradeBandCreateInput extends GradeBandInput {
  /** The school's existing bands, used to refuse an overlapping range. */
  readonly existingBands: readonly GradeBandSummary[];
}

/**
 * Parses one grade band and refuses a range that overlaps an existing band.
 *
 * Overlap is the rule that makes grading deterministic: with two bands starting
 * at 40 and 60, a score of 65 would otherwise match two bands and the "right"
 * grade would depend on row order.
 */
export function parseGradeBandCreateInput(
  body: unknown,
): ParseResult<GradeBandInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const min = readNumber(body, "minPercentage", "Enter a minimum percentage.");
  if (!min.ok) {
    return min;
  }
  if (min.value < 0 || min.value > 100) {
    return {
      ok: false,
      message: "A minimum percentage must be between 0 and 100.",
    };
  }

  const rawLabel = readString(body, "label");
  const label = rawLabel === null ? null : rawLabel.trim();
  if (
    label === null ||
    label.length === 0 ||
    label.length > GRADE_BAND_LABEL_MAX_LENGTH
  ) {
    return {
      ok: false,
      message: `Enter a grade label of 1 to ${GRADE_BAND_LABEL_MAX_LENGTH} characters.`,
    };
  }

  const remark = noteField(
    body,
    "remark",
    GRADE_BAND_REMARK_MAX_LENGTH,
    "remark",
  );
  if (!remark.ok) {
    return remark;
  }

  const rawPassing = body["isPassing"];
  if (typeof rawPassing !== "boolean") {
    return { ok: false, message: "Invalid request body." };
  }

  return {
    ok: true,
    value: {
      minPercentage: min.value,
      label,
      remark: remark.value,
      isPassing: rawPassing,
    },
  };
}

/**
 * The existing band whose range `minPercentage` falls inside, or `null` when the
 * new band only extends the scale downward.
 *
 * A band owns everything from its own minimum up to the next band's minimum. So
 * with bands at 0, 50 and 70, a new band at 60 or 75 would fall *inside* an
 * existing band's range and split it — which silently reinterprets every score
 * already graded under that band, because a score of 65 that was graded "D6"
 * would become "C4".
 *
 * The rule this expresses is therefore: a new band may only be added *below* the
 * lowest existing band, or by editing an existing band's bound. Anything else is
 * refused, because a school changing its scale mid-year must not silently change
 * what last term's grades mean.
 */
export function findOverlappingBand(
  minPercentage: number,
  bands: readonly GradeBandSummary[],
): GradeBandSummary | null {
  let owner: GradeBandSummary | null = null;
  for (const band of bands) {
    if (band.minPercentage <= minPercentage) {
      if (owner === null || band.minPercentage > owner.minPercentage) {
        owner = band;
      }
    }
  }
  return owner;
}

export interface GradeBandUpdateInput {
  readonly bandId: string;
  readonly label?: string;
  readonly remark?: string | null;
  readonly isPassing?: boolean;
}

export function parseGradeBandUpdateInput(
  body: unknown,
): ParseResult<GradeBandUpdateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const id = uuidField(body, "bandId", "Invalid request body.");
  if (!id.ok) {
    return id;
  }

  const value: {
    bandId: string;
    label?: string;
    remark?: string | null;
    isPassing?: boolean;
  } = { bandId: id.value };

  if (has(body, "label")) {
    const raw = readString(body, "label");
    const label = raw === null ? null : raw.trim();
    if (
      label === null ||
      label.length === 0 ||
      label.length > GRADE_BAND_LABEL_MAX_LENGTH
    ) {
      return {
        ok: false,
        message: `Enter a grade label of 1 to ${GRADE_BAND_LABEL_MAX_LENGTH} characters.`,
      };
    }
    value.label = label;
  }

  if (has(body, "remark")) {
    const remark = noteField(
      body,
      "remark",
      GRADE_BAND_REMARK_MAX_LENGTH,
      "remark",
    );
    if (!remark.ok) {
      return remark;
    }
    value.remark = remark.value;
  }

  if (has(body, "isPassing")) {
    const raw = body["isPassing"];
    if (typeof raw !== "boolean") {
      return { ok: false, message: "Invalid request body." };
    }
    value.isPassing = raw;
  }

  if (
    value.label === undefined &&
    value.remark === undefined &&
    value.isPassing === undefined
  ) {
    return { ok: false, message: "Invalid request body." };
  }

  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export interface AssessmentCreateInput {
  readonly classId: string;
  readonly subjectId: string | null;
  readonly termId: string | null;
  readonly name: string;
  readonly maxScore: number;
  readonly assessedOn: string;
  readonly notes: string | null;
}

export function parseAssessmentCreateInput(
  body: unknown,
  today: string,
): ParseResult<AssessmentCreateInput> {
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
  const termId = optionalUuidField(body, "termId", "Invalid term.");
  if (!termId.ok) {
    return termId;
  }

  const rawName = readString(body, "name");
  const name = rawName === null ? null : rawName.trim();
  if (
    name === null ||
    name.length === 0 ||
    name.length > ASSESSMENT_NAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      message: `Enter an assessment name of 1 to ${ASSESSMENT_NAME_MAX_LENGTH} characters.`,
    };
  }

  const max = readNumber(body, "maxScore", "Enter the maximum score.");
  if (!max.ok) {
    return max;
  }
  if (max.value <= 0 || max.value > ASSESSMENT_MAX_SCORE_LIMIT) {
    return {
      ok: false,
      message: `The maximum score must be between 0 and ${ASSESSMENT_MAX_SCORE_LIMIT}.`,
    };
  }

  const rawDate = readString(body, "assessedOn");
  if (rawDate === null || !isIsoDate(rawDate.trim())) {
    return { ok: false, message: "Choose a valid date (YYYY-MM-DD)." };
  }
  const assessedOn = rawDate.trim();
  if (assessedOn > today) {
    return {
      ok: false,
      message: "An assessment cannot be dated in the future.",
    };
  }

  const notes = noteField(body, "notes", ASSESSMENT_NOTE_MAX_LENGTH, "note");
  if (!notes.ok) {
    return notes;
  }

  return {
    ok: true,
    value: {
      classId: classId.value,
      subjectId: subjectId.value,
      termId: termId.value,
      name,
      maxScore: max.value,
      assessedOn,
      notes: notes.value,
    },
  };
}

export interface AssessmentUpdateInput {
  readonly assessmentId: string;
  readonly name?: string;
  readonly maxScore?: number;
  readonly assessedOn?: string;
  readonly notes?: string | null;
  readonly isActive?: boolean;
}

export function parseAssessmentUpdateInput(
  body: unknown,
  today: string,
): ParseResult<AssessmentUpdateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const id = uuidField(body, "assessmentId", "Invalid request body.");
  if (!id.ok) {
    return id;
  }

  const value: {
    assessmentId: string;
    name?: string;
    maxScore?: number;
    assessedOn?: string;
    notes?: string | null;
    isActive?: boolean;
  } = { assessmentId: id.value };

  if (has(body, "name")) {
    const raw = readString(body, "name");
    const name = raw === null ? null : raw.trim();
    if (
      name === null ||
      name.length === 0 ||
      name.length > ASSESSMENT_NAME_MAX_LENGTH
    ) {
      return {
        ok: false,
        message: `Enter an assessment name of 1 to ${ASSESSMENT_NAME_MAX_LENGTH} characters.`,
      };
    }
    value.name = name;
  }

  if (has(body, "maxScore")) {
    const max = readNumber(body, "maxScore", "Enter the maximum score.");
    if (!max.ok) {
      return max;
    }
    if (max.value <= 0 || max.value > ASSESSMENT_MAX_SCORE_LIMIT) {
      return {
        ok: false,
        message: `The maximum score must be between 0 and ${ASSESSMENT_MAX_SCORE_LIMIT}.`,
      };
    }
    value.maxScore = max.value;
  }

  if (has(body, "assessedOn")) {
    const raw = readString(body, "assessedOn");
    if (raw === null || !isIsoDate(raw.trim())) {
      return { ok: false, message: "Choose a valid date (YYYY-MM-DD)." };
    }
    const assessedOn = raw.trim();
    if (assessedOn > today) {
      return {
        ok: false,
        message: "An assessment cannot be dated in the future.",
      };
    }
    value.assessedOn = assessedOn;
  }

  if (has(body, "notes")) {
    const notes = noteField(body, "notes", ASSESSMENT_NOTE_MAX_LENGTH, "note");
    if (!notes.ok) {
      return notes;
    }
    value.notes = notes.value;
  }

  if (has(body, "isActive")) {
    const raw = body["isActive"];
    if (typeof raw !== "boolean") {
      return { ok: false, message: "Invalid request body." };
    }
    value.isActive = raw;
  }

  if (
    value.name === undefined &&
    value.maxScore === undefined &&
    value.assessedOn === undefined &&
    value.notes === undefined &&
    value.isActive === undefined
  ) {
    return { ok: false, message: "Invalid request body." };
  }

  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface ResultEntryInput {
  readonly learnerId: string;
  /** Null marks the learner as unmarked rather than removing the row. */
  readonly score: number | null;
  readonly remark: string | null;
}

export interface ResultSubmitInput {
  readonly assessmentId: string;
  readonly maxScore: number;
  readonly entries: readonly ResultEntryInput[];
}

export function parseResultSubmitInput(
  body: unknown,
): ParseResult<ResultSubmitInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const assessmentId = uuidField(body, "assessmentId", "Invalid request body.");
  if (!assessmentId.ok) {
    return assessmentId;
  }

  // The maximum travels with the submission so the score ceiling can be checked
  // here as well as by the database trigger, and the caller gets a message that
  // names the problem rather than a bare constraint violation.
  const max = readNumber(body, "maxScore", "Enter the maximum score.");
  if (!max.ok) {
    return max;
  }
  if (max.value <= 0 || max.value > ASSESSMENT_MAX_SCORE_LIMIT) {
    return {
      ok: false,
      message: `The maximum score must be between 0 and ${ASSESSMENT_MAX_SCORE_LIMIT}.`,
    };
  }

  const rawEntries = body["entries"];
  if (!Array.isArray(rawEntries)) {
    return { ok: false, message: "Submit the class result sheet." };
  }
  if (rawEntries.length === 0) {
    return { ok: false, message: "Mark at least one learner." };
  }
  if (rawEntries.length > ASSESSMENT_MAX_ENTRIES) {
    return {
      ok: false,
      message: `A result sheet can hold at most ${ASSESSMENT_MAX_ENTRIES} learners.`,
    };
  }

  const seen = new Set<string>();
  const entries: ResultEntryInput[] = [];

  for (const raw of rawEntries) {
    if (!isRecord(raw)) {
      return { ok: false, message: "Invalid result entry." };
    }

    const learnerId = uuidField(raw, "learnerId", "Invalid result entry.");
    if (!learnerId.ok) {
      return learnerId;
    }
    if (seen.has(learnerId.value)) {
      return {
        ok: false,
        message: "Each learner can appear only once in a result sheet.",
      };
    }
    seen.add(learnerId.value);

    if (has(raw, "score") && raw["score"] !== null) {
      const score = readNumber(raw, "score", "Enter a valid score.");
      if (!score.ok) {
        return score;
      }
      if (score.value < 0 || score.value > max.value) {
        return {
          ok: false,
          message: `A score must be between 0 and ${max.value}.`,
        };
      }
    }

    const remark = noteField(
      raw,
      "remark",
      ASSESSMENT_NOTE_MAX_LENGTH,
      "remark",
    );
    if (!remark.ok) {
      return remark;
    }

    entries.push({
      learnerId: learnerId.value,
      score: has(raw, "score") ? (raw["score"] as number | null) : null,
      remark: remark.value,
    });
  }

  return {
    ok: true,
    value: { assessmentId: assessmentId.value, maxScore: max.value, entries },
  };
}

// ---------------------------------------------------------------------------
// Academic report
// ---------------------------------------------------------------------------

export interface AcademicReportQuery {
  readonly classId: string;
  readonly from: string | null;
  readonly to: string | null;
}

export interface QueryReader {
  get(name: string): string | null;
}

/** Parses the class academic report filter. Only `classId` is required. */
export function parseAcademicReportQuery(
  query: QueryReader,
): ParseResult<AcademicReportQuery> {
  const rawClass = query.get("classId");
  if (rawClass === null || !isUuid(rawClass.trim())) {
    return { ok: false, message: "Choose a class." };
  }

  const from = readOptionalDate(query, "from");
  if (from === "") {
    return { ok: false, message: "Choose a valid date (YYYY-MM-DD)." };
  }
  const to = readOptionalDate(query, "to");
  if (to === "") {
    return { ok: false, message: "Choose a valid date (YYYY-MM-DD)." };
  }

  if (from !== null && to !== null && to < from) {
    return {
      ok: false,
      message: "The end date must be on or after the start date.",
    };
  }

  return { ok: true, value: { classId: rawClass.trim(), from, to } };
}

function readOptionalDate(query: QueryReader, key: string): string | null | "" {
  const raw = query.get(key);
  if (raw === null || raw.trim().length === 0) {
    return null;
  }
  const value = raw.trim();
  return isIsoDate(value) ? value : "";
}
