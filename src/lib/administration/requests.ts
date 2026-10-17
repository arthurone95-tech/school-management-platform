/**
 * Request parsing and validation for the Phase 3 administration endpoints
 * (school profile, academic years and terms, subjects, staff membership status
 * and staff assignments).
 *
 * Pure and isomorphic (no Node-only or database imports) so the rules are
 * unit-tested without a database. These helpers only decide whether a request
 * is well formed; authentication, school membership and the permission check
 * happen in trusted server code, and Row Level Security is the database-level
 * boundary (docs/DECISIONS.md D-029, docs/AGENTS.md 5).
 */

/** Shortest school name accepted (matches `public.schools.name`, migration 0001). */
export const SCHOOL_NAME_MIN_LENGTH = 2;
/** Longest school name accepted (matches `public.schools.name`, migration 0001). */
export const SCHOOL_NAME_MAX_LENGTH = 120;
/** Longest academic-year label accepted (matches migration 0005). */
export const ACADEMIC_YEAR_NAME_MAX_LENGTH = 80;
/** Longest term label accepted (matches migration 0005). */
export const TERM_NAME_MAX_LENGTH = 40;
/** Longest subject name accepted (matches migration 0005). */
export const SUBJECT_NAME_MAX_LENGTH = 80;
/** Longest subject short code accepted (matches migration 0005). */
export const SUBJECT_CODE_MAX_LENGTH = 20;

/** The membership-status actions an administrator may apply (D-023 pattern). */
export const MEMBER_STATUS_ACTIONS = ["suspend", "restore", "revoke"] as const;
export type MemberStatusAction = (typeof MEMBER_STATUS_ACTIONS)[number];

import { isIsoDate } from "@/lib/dates";

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

/** Trims a label and returns it only when it is non-empty and within `max`. */
function cleanLabel(raw: string, max: number): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    return null;
  }
  return trimmed;
}

function idField(
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

// ---------------------------------------------------------------------------
// School profile (area 1)
// ---------------------------------------------------------------------------

export function parseSchoolProfileUpdateInput(
  body: unknown,
): ParseResult<{ name: string }> {
  if (!isRecord(body)) {
    return { ok: false, message: "Enter the school name." };
  }

  const raw = readString(body, "name");
  const name = raw === null ? null : cleanLabel(raw, SCHOOL_NAME_MAX_LENGTH);
  if (name === null || name.length < SCHOOL_NAME_MIN_LENGTH) {
    return {
      ok: false,
      message: `Enter a school name of ${SCHOOL_NAME_MIN_LENGTH} to ${SCHOOL_NAME_MAX_LENGTH} characters.`,
    };
  }

  return { ok: true, value: { name } };
}

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------

export interface AcademicYearCreateInput {
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export function parseAcademicYearCreateInput(
  body: unknown,
): ParseResult<AcademicYearCreateInput> {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Enter a year name and its start and end dates.",
    };
  }

  const rawName = readString(body, "name");
  const name =
    rawName === null
      ? null
      : cleanLabel(rawName, ACADEMIC_YEAR_NAME_MAX_LENGTH);
  if (name === null) {
    return {
      ok: false,
      message: `Enter a year name of 1 to ${ACADEMIC_YEAR_NAME_MAX_LENGTH} characters.`,
    };
  }

  const startsOn = readString(body, "startsOn");
  const endsOn = readString(body, "endsOn");
  if (startsOn === null || !isIsoDate(startsOn)) {
    return { ok: false, message: "Enter a valid start date (YYYY-MM-DD)." };
  }
  if (endsOn === null || !isIsoDate(endsOn)) {
    return { ok: false, message: "Enter a valid end date (YYYY-MM-DD)." };
  }
  if (endsOn < startsOn) {
    return {
      ok: false,
      message: "The end date must be on or after the start date.",
    };
  }

  return { ok: true, value: { name, startsOn, endsOn } };
}

export interface AcademicYearUpdateInput {
  readonly academicYearId: string;
  readonly name?: string;
  readonly startsOn?: string;
  readonly endsOn?: string;
  readonly isCurrent?: boolean;
}

export function parseAcademicYearUpdateInput(
  body: unknown,
): ParseResult<AcademicYearUpdateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const id = idField(body, "academicYearId", "Invalid request body.");
  if (!id.ok) {
    return id;
  }

  const value: {
    academicYearId: string;
    name?: string;
    startsOn?: string;
    endsOn?: string;
    isCurrent?: boolean;
  } = { academicYearId: id.value };

  if (has(body, "name")) {
    const raw = readString(body, "name");
    const name =
      raw === null ? null : cleanLabel(raw, ACADEMIC_YEAR_NAME_MAX_LENGTH);
    if (name === null) {
      return {
        ok: false,
        message: `Enter a year name of 1 to ${ACADEMIC_YEAR_NAME_MAX_LENGTH} characters.`,
      };
    }
    value.name = name;
  }

  if (has(body, "startsOn")) {
    const startsOn = readString(body, "startsOn");
    if (startsOn === null || !isIsoDate(startsOn)) {
      return { ok: false, message: "Enter a valid start date (YYYY-MM-DD)." };
    }
    value.startsOn = startsOn;
  }

  if (has(body, "endsOn")) {
    const endsOn = readString(body, "endsOn");
    if (endsOn === null || !isIsoDate(endsOn)) {
      return { ok: false, message: "Enter a valid end date (YYYY-MM-DD)." };
    }
    value.endsOn = endsOn;
  }

  if (has(body, "isCurrent")) {
    const raw = body["isCurrent"];
    if (typeof raw !== "boolean") {
      return { ok: false, message: "Invalid request body." };
    }
    value.isCurrent = raw;
  }

  if (
    value.name === undefined &&
    value.startsOn === undefined &&
    value.endsOn === undefined &&
    value.isCurrent === undefined
  ) {
    return { ok: false, message: "Invalid request body." };
  }

  if (
    value.startsOn !== undefined &&
    value.endsOn !== undefined &&
    value.endsOn < value.startsOn
  ) {
    return {
      ok: false,
      message: "The end date must be on or after the start date.",
    };
  }

  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export interface TermCreateInput {
  readonly academicYearId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export function parseTermCreateInput(
  body: unknown,
): ParseResult<TermCreateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const year = idField(body, "academicYearId", "Invalid request body.");
  if (!year.ok) {
    return year;
  }

  const rawName = readString(body, "name");
  const name =
    rawName === null ? null : cleanLabel(rawName, TERM_NAME_MAX_LENGTH);
  if (name === null) {
    return {
      ok: false,
      message: `Enter a term name of 1 to ${TERM_NAME_MAX_LENGTH} characters.`,
    };
  }

  const startsOn = readString(body, "startsOn");
  const endsOn = readString(body, "endsOn");
  if (startsOn === null || !isIsoDate(startsOn)) {
    return { ok: false, message: "Enter a valid start date (YYYY-MM-DD)." };
  }
  if (endsOn === null || !isIsoDate(endsOn)) {
    return { ok: false, message: "Enter a valid end date (YYYY-MM-DD)." };
  }
  if (endsOn < startsOn) {
    return {
      ok: false,
      message: "The end date must be on or after the start date.",
    };
  }

  return {
    ok: true,
    value: { academicYearId: year.value, name, startsOn, endsOn },
  };
}

export interface TermUpdateInput {
  readonly termId: string;
  readonly name?: string;
  readonly startsOn?: string;
  readonly endsOn?: string;
}

export function parseTermUpdateInput(
  body: unknown,
): ParseResult<TermUpdateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const id = idField(body, "termId", "Invalid request body.");
  if (!id.ok) {
    return id;
  }

  const value: {
    termId: string;
    name?: string;
    startsOn?: string;
    endsOn?: string;
  } = { termId: id.value };

  if (has(body, "name")) {
    const raw = readString(body, "name");
    const name = raw === null ? null : cleanLabel(raw, TERM_NAME_MAX_LENGTH);
    if (name === null) {
      return {
        ok: false,
        message: `Enter a term name of 1 to ${TERM_NAME_MAX_LENGTH} characters.`,
      };
    }
    value.name = name;
  }

  if (has(body, "startsOn")) {
    const startsOn = readString(body, "startsOn");
    if (startsOn === null || !isIsoDate(startsOn)) {
      return { ok: false, message: "Enter a valid start date (YYYY-MM-DD)." };
    }
    value.startsOn = startsOn;
  }

  if (has(body, "endsOn")) {
    const endsOn = readString(body, "endsOn");
    if (endsOn === null || !isIsoDate(endsOn)) {
      return { ok: false, message: "Enter a valid end date (YYYY-MM-DD)." };
    }
    value.endsOn = endsOn;
  }

  if (
    value.name === undefined &&
    value.startsOn === undefined &&
    value.endsOn === undefined
  ) {
    return { ok: false, message: "Invalid request body." };
  }

  if (
    value.startsOn !== undefined &&
    value.endsOn !== undefined &&
    value.endsOn < value.startsOn
  ) {
    return {
      ok: false,
      message: "The end date must be on or after the start date.",
    };
  }

  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export interface SubjectCreateInput {
  readonly name: string;
  readonly code: string | null;
}

export function parseSubjectCreateInput(
  body: unknown,
): ParseResult<SubjectCreateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Enter the subject name." };
  }

  const rawName = readString(body, "name");
  const name =
    rawName === null ? null : cleanLabel(rawName, SUBJECT_NAME_MAX_LENGTH);
  if (name === null) {
    return {
      ok: false,
      message: `Enter a subject name of 1 to ${SUBJECT_NAME_MAX_LENGTH} characters.`,
    };
  }

  const codeResult = readOptionalCode(body);
  if (!codeResult.ok) {
    return codeResult;
  }

  return { ok: true, value: { name, code: codeResult.value } };
}

export interface SubjectUpdateInput {
  readonly subjectId: string;
  readonly name?: string;
  readonly code?: string | null;
  readonly isActive?: boolean;
}

export function parseSubjectUpdateInput(
  body: unknown,
): ParseResult<SubjectUpdateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const id = idField(body, "subjectId", "Invalid request body.");
  if (!id.ok) {
    return id;
  }

  const value: {
    subjectId: string;
    name?: string;
    code?: string | null;
    isActive?: boolean;
  } = { subjectId: id.value };

  if (has(body, "name")) {
    const raw = readString(body, "name");
    const name = raw === null ? null : cleanLabel(raw, SUBJECT_NAME_MAX_LENGTH);
    if (name === null) {
      return {
        ok: false,
        message: `Enter a subject name of 1 to ${SUBJECT_NAME_MAX_LENGTH} characters.`,
      };
    }
    value.name = name;
  }

  if (has(body, "code")) {
    const codeResult = readOptionalCode(body);
    if (!codeResult.ok) {
      return codeResult;
    }
    value.code = codeResult.value;
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
    value.code === undefined &&
    value.isActive === undefined
  ) {
    return { ok: false, message: "Invalid request body." };
  }

  return { ok: true, value };
}

/** Reads `code` as a trimmed string or `null` (an empty value clears it). */
function readOptionalCode(
  body: Record<string, unknown>,
): ParseResult<string | null> {
  const raw = body["code"];
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "Enter a valid subject code." };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > SUBJECT_CODE_MAX_LENGTH) {
    return {
      ok: false,
      message: `A subject code can be at most ${SUBJECT_CODE_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

// ---------------------------------------------------------------------------
// Staff membership status
// ---------------------------------------------------------------------------

export interface MemberStatusInput {
  readonly membershipId: string;
  readonly action: MemberStatusAction;
}

export function parseMemberStatusInput(
  body: unknown,
): ParseResult<MemberStatusInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const id = idField(body, "membershipId", "Invalid request body.");
  if (!id.ok) {
    return id;
  }

  const action = readString(body, "action");
  if (
    action === null ||
    !(MEMBER_STATUS_ACTIONS as readonly string[]).includes(action)
  ) {
    return { ok: false, message: "Choose a valid membership action." };
  }

  return {
    ok: true,
    value: { membershipId: id.value, action: action as MemberStatusAction },
  };
}

// ---------------------------------------------------------------------------
// Staff assignments
// ---------------------------------------------------------------------------

export interface AssignmentCreateInput {
  readonly membershipId: string;
  readonly classId: string | null;
  readonly subjectId: string | null;
}

export function parseAssignmentCreateInput(
  body: unknown,
): ParseResult<AssignmentCreateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const member = idField(body, "membershipId", "Invalid request body.");
  if (!member.ok) {
    return member;
  }

  const classId = readNullableId(body, "classId");
  if (classId === undefined) {
    return { ok: false, message: "Invalid request body." };
  }
  const subjectId = readNullableId(body, "subjectId");
  if (subjectId === undefined) {
    return { ok: false, message: "Invalid request body." };
  }

  if (classId === null && subjectId === null) {
    return {
      ok: false,
      message: "Choose a class, a subject, or both for the assignment.",
    };
  }

  return {
    ok: true,
    value: { membershipId: member.value, classId, subjectId },
  };
}

export interface AssignmentDeleteInput {
  readonly assignmentId: string;
}

export function parseAssignmentDeleteInput(
  body: unknown,
): ParseResult<AssignmentDeleteInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }
  const id = idField(body, "assignmentId", "Invalid request body.");
  if (!id.ok) {
    return id;
  }
  return { ok: true, value: { assignmentId: id.value } };
}

/** Returns a uuid, `null` for an empty value, or `undefined` when malformed. */
function readNullableId(
  body: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  if (typeof raw !== "string" || !isUuid(raw.trim())) {
    return undefined;
  }
  return raw.trim();
}
