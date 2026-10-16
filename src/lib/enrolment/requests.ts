/**
 * Request parsing and validation for the enrolment (student registration and
 * class placement) endpoints.
 *
 * Pure and isomorphic (no Node-only or database imports) so the rules are
 * unit-tested without a database. These helpers only decide whether a request
 * is well formed; authentication, school membership and the permission check
 * happen in trusted server code, and Row Level Security is the database-level
 * boundary (docs/DECISIONS.md D-018, D-019, docs/ENROLMENT_PERMISSION_MODEL.md).
 */

import {
  isValidRegistrationNumber,
  normaliseRegistrationNumber,
  REGISTRATION_NUMBER_MAX_LENGTH,
} from "@/lib/domain/identifiers";

/** The gender values accepted by `public.learners.gender` (migration 0001). */
export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

export const GUARDIAN_EMAIL_MAX_LENGTH = 254;
export const NAME_MAX_LENGTH = 80;
export const ADDRESS_MAX_LENGTH = 400;
export const GUARDIAN_PHONE_MAX_LENGTH = 40;

/** Label shown for a learner who has no current class placement. */
export const UNPLACED_LABEL = "No class yet";

/** Rows returned by the learner list per page (bounded result sets, AGENTS.md 6). */
export const LEARNER_PAGE_SIZE = 25;

/** The earliest date of birth the form accepts; guards against typo centuries. */
export const EARLIEST_DATE_OF_BIRTH = "1900-01-01";

export interface EnrolmentInput {
  readonly registrationNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly gender: Gender;
  readonly dateOfBirth: string;
  readonly residentialAddress: string;
  readonly guardianPhone: string;
  readonly guardianEmail: string | null;
  readonly classId: string;
}

/** Local mirror of the shared parse result shape (`@/lib/staff/requests`). */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" ? value : null;
}

/** Minimal address shape; mirrors the staff rule. Deliverability is not decided here. */
function isEmailLike(value: string): boolean {
  if (value.length === 0 || value.length > GUARDIAN_EMAIL_MAX_LENGTH) {
    return false;
  }
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) {
    return false;
  }
  return value.slice(at + 1).indexOf(".") !== -1;
}

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** A real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30 etc.). */
function isRealCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === value;
}

/** The current date in UTC as `YYYY-MM-DD`; injectable for deterministic tests. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function trimmedLengthValid(value: string, max: number): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max;
}

/** Longest class name accepted; mirrors `public.classes.name` (migration 0001). */
export const CLASS_NAME_MAX_LENGTH = 80;

/** The learner states allowed by `public.learners.status` (migration 0001, 5.2). */
export const LEARNER_STATUSES = ["active", "inactive"] as const;
export type LearnerStatus = (typeof LEARNER_STATUSES)[number];

export function isLearnerStatus(value: string): value is LearnerStatus {
  return (LEARNER_STATUSES as readonly string[]).includes(value);
}

const FIRST_NAME_MESSAGE = "Enter the student's first name.";
const LAST_NAME_MESSAGE = "Enter the student's last name.";
const CLASS_ID_MESSAGE = "Choose a class for the student.";
const LEARNER_ID_MESSAGE = "Invalid request body.";

/**
 * Field-level validators shared by the enrolment and correction parsers, so the
 * two entry points into a learner record cannot drift apart (AGENTS.md 11).
 * Each returns the normalised value or the message to show the user.
 */

function checkRegistrationNumber(raw: string): ParseResult<string> {
  if (!isValidRegistrationNumber(raw)) {
    return {
      ok: false,
      message: `Enter a registration number (1–${REGISTRATION_NUMBER_MAX_LENGTH} characters).`,
    };
  }
  return { ok: true, value: normaliseRegistrationNumber(raw) };
}

function checkName(raw: string, message: string): ParseResult<string> {
  if (!trimmedLengthValid(raw, NAME_MAX_LENGTH)) {
    return { ok: false, message };
  }
  return { ok: true, value: raw.trim() };
}

function checkGender(raw: string): ParseResult<Gender> {
  if (!isGender(raw)) {
    return { ok: false, message: "Choose the student's gender." };
  }
  return { ok: true, value: raw };
}

function checkDateOfBirth(raw: string, now: Date): ParseResult<string> {
  if (!isRealCalendarDate(raw)) {
    return {
      ok: false,
      message: "Enter a valid date of birth in YYYY-MM-DD form.",
    };
  }
  if (raw > utcToday(now)) {
    return { ok: false, message: "The date of birth cannot be in the future." };
  }
  if (raw < EARLIEST_DATE_OF_BIRTH) {
    return {
      ok: false,
      message: `Enter a date of birth on or after ${EARLIEST_DATE_OF_BIRTH}.`,
    };
  }
  return { ok: true, value: raw };
}

function checkAddress(raw: string): ParseResult<string> {
  if (!trimmedLengthValid(raw, ADDRESS_MAX_LENGTH)) {
    return {
      ok: false,
      message: `Enter the student's residential address (1–${ADDRESS_MAX_LENGTH} characters).`,
    };
  }
  return { ok: true, value: raw.trim() };
}

function checkGuardianPhone(raw: string): ParseResult<string> {
  if (!trimmedLengthValid(raw, GUARDIAN_PHONE_MAX_LENGTH)) {
    return {
      ok: false,
      message: `Enter a guardian phone number (1–${GUARDIAN_PHONE_MAX_LENGTH} characters).`,
    };
  }
  return { ok: true, value: raw.trim() };
}

/** Optional: an absent, blank or whitespace-only value means "not provided". */
function checkOptionalGuardianEmail(
  raw: string | null,
): ParseResult<string | null> {
  if (raw === null || raw.trim().length === 0) {
    return { ok: true, value: null };
  }
  const normalised = normaliseEmail(raw);
  if (!isEmailLike(normalised)) {
    return {
      ok: false,
      message: "Enter a valid guardian email address, or leave it blank.",
    };
  }
  return { ok: true, value: normalised };
}

function checkUuid(raw: string, message: string): ParseResult<string> {
  const trimmed = raw.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    return { ok: false, message };
  }
  return { ok: true, value: trimmed };
}

/**
 * Parses and validates an enrolment body. `now` is injectable so the
 * "date of birth must not be in the future" rule can be tested deterministically.
 */
export function parseEnrolmentInput(
  body: unknown,
  now: Date = new Date(),
): ParseResult<EnrolmentInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const registration = checkRegistrationNumber(
    readString(body, "registrationNumber") ?? "",
  );
  if (!registration.ok) {
    return registration;
  }

  const firstName = checkName(
    readString(body, "firstName") ?? "",
    FIRST_NAME_MESSAGE,
  );
  if (!firstName.ok) {
    return firstName;
  }

  const lastName = checkName(
    readString(body, "lastName") ?? "",
    LAST_NAME_MESSAGE,
  );
  if (!lastName.ok) {
    return lastName;
  }

  const gender = checkGender(readString(body, "gender") ?? "");
  if (!gender.ok) {
    return gender;
  }

  const dateOfBirth = checkDateOfBirth(
    readString(body, "dateOfBirth") ?? "",
    now,
  );
  if (!dateOfBirth.ok) {
    return dateOfBirth;
  }

  const residentialAddress = checkAddress(
    readString(body, "residentialAddress") ?? "",
  );
  if (!residentialAddress.ok) {
    return residentialAddress;
  }

  const guardianPhone = checkGuardianPhone(
    readString(body, "guardianPhone") ?? "",
  );
  if (!guardianPhone.ok) {
    return guardianPhone;
  }

  const guardianEmail = checkOptionalGuardianEmail(
    readString(body, "guardianEmail"),
  );
  if (!guardianEmail.ok) {
    return guardianEmail;
  }

  const classId = checkUuid(
    readString(body, "classId") ?? "",
    CLASS_ID_MESSAGE,
  );
  if (!classId.ok) {
    return classId;
  }

  return {
    ok: true,
    value: {
      registrationNumber: registration.value,
      firstName: firstName.value,
      lastName: lastName.value,
      gender: gender.value,
      dateOfBirth: dateOfBirth.value,
      residentialAddress: residentialAddress.value,
      guardianPhone: guardianPhone.value,
      guardianEmail: guardianEmail.value,
      classId: classId.value,
    },
  };
}

/**
 * Parses the `page` query parameter for the learner list. Anything missing,
 * non-numeric or below 1 becomes page 1; the value is capped so a hostile value
 * cannot request an unbounded offset.
 */
export function parsePageParam(raw: string | null): number {
  if (raw === null) {
    return 1;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, 10000);
}

/**
 * Parses the `status` filter for the learner list. Anything that is not exactly
 * `inactive` means the routine, active-only view, so a missing or hostile value
 * cannot accidentally widen the query to every record (D-023: inactive records
 * are not part of routine operational views).
 */
export function parseLearnerStatusFilter(raw: string | null): LearnerStatus {
  return raw === "inactive" ? "inactive" : "active";
}

export interface ClassCreateInput {
  readonly name: string;
}

export interface ClassUpdateInput {
  readonly classId: string;
  readonly name?: string;
  readonly isActive?: boolean;
}

/** `undefined` means "leave unchanged"; an explicit `null` clears an optional value. */
export interface LearnerCorrectionInput {
  readonly learnerId: string;
  readonly registrationNumber?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly gender?: Gender;
  readonly dateOfBirth?: string;
  readonly residentialAddress?: string;
  readonly guardianPhone?: string;
  readonly guardianEmail?: string | null;
}

export interface LearnerStatusInput {
  readonly learnerId: string;
  readonly status: LearnerStatus;
}

export interface PlacementChangeInput {
  readonly learnerId: string;
  readonly classId: string;
}

const CLASS_NAME_MESSAGE = `Enter a class name (1–${CLASS_NAME_MAX_LENGTH} characters).`;

function checkClassName(raw: string): ParseResult<string> {
  if (!trimmedLengthValid(raw, CLASS_NAME_MAX_LENGTH)) {
    return { ok: false, message: CLASS_NAME_MESSAGE };
  }
  return { ok: true, value: raw.trim() };
}

/** Parses a "create a class" body: a required, school-unique name. */
export function parseClassCreateInput(
  body: unknown,
): ParseResult<ClassCreateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }
  const name = checkClassName(readString(body, "name") ?? "");
  if (!name.ok) {
    return name;
  }
  return { ok: true, value: { name: name.value } };
}

/**
 * Parses a "change a class" body: the class id plus at least one of a new name
 * or a new active flag. Omitting both is rejected so an empty request cannot
 * silently succeed.
 */
export function parseClassUpdateInput(
  body: unknown,
): ParseResult<ClassUpdateInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const classId = checkUuid(
    readString(body, "classId") ?? "",
    "Invalid request body.",
  );
  if (!classId.ok) {
    return classId;
  }

  let name: string | undefined;
  if ("name" in body) {
    const checked = checkClassName(readString(body, "name") ?? "");
    if (!checked.ok) {
      return checked;
    }
    name = checked.value;
  }

  let isActive: boolean | undefined;
  if ("isActive" in body) {
    const raw = body.isActive;
    if (typeof raw !== "boolean") {
      return { ok: false, message: "Invalid request body." };
    }
    isActive = raw;
  }

  if (name === undefined && isActive === undefined) {
    return { ok: false, message: "Provide a new name or a new status." };
  }

  return { ok: true, value: { classId: classId.value, name, isActive } };
}

/**
 * Parses a correction body: the learner id plus at least one field to change.
 * Fields that are absent are left untouched by the update, so a partial
 * correction cannot blank unrelated columns.
 */
export function parseLearnerCorrectionInput(
  body: unknown,
  now: Date = new Date(),
): ParseResult<LearnerCorrectionInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const learnerId = checkUuid(
    readString(body, "learnerId") ?? "",
    LEARNER_ID_MESSAGE,
  );
  if (!learnerId.ok) {
    return learnerId;
  }

  const value: {
    learnerId: string;
    registrationNumber?: string;
    firstName?: string;
    lastName?: string;
    gender?: Gender;
    dateOfBirth?: string;
    residentialAddress?: string;
    guardianPhone?: string;
    guardianEmail?: string | null;
  } = { learnerId: learnerId.value };

  if ("registrationNumber" in body) {
    const checked = checkRegistrationNumber(
      readString(body, "registrationNumber") ?? "",
    );
    if (!checked.ok) {
      return checked;
    }
    value.registrationNumber = checked.value;
  }

  if ("firstName" in body) {
    const checked = checkName(
      readString(body, "firstName") ?? "",
      FIRST_NAME_MESSAGE,
    );
    if (!checked.ok) {
      return checked;
    }
    value.firstName = checked.value;
  }

  if ("lastName" in body) {
    const checked = checkName(
      readString(body, "lastName") ?? "",
      LAST_NAME_MESSAGE,
    );
    if (!checked.ok) {
      return checked;
    }
    value.lastName = checked.value;
  }

  if ("gender" in body) {
    const checked = checkGender(readString(body, "gender") ?? "");
    if (!checked.ok) {
      return checked;
    }
    value.gender = checked.value;
  }

  if ("dateOfBirth" in body) {
    const checked = checkDateOfBirth(
      readString(body, "dateOfBirth") ?? "",
      now,
    );
    if (!checked.ok) {
      return checked;
    }
    value.dateOfBirth = checked.value;
  }

  if ("residentialAddress" in body) {
    const checked = checkAddress(readString(body, "residentialAddress") ?? "");
    if (!checked.ok) {
      return checked;
    }
    value.residentialAddress = checked.value;
  }

  if ("guardianPhone" in body) {
    const checked = checkGuardianPhone(readString(body, "guardianPhone") ?? "");
    if (!checked.ok) {
      return checked;
    }
    value.guardianPhone = checked.value;
  }

  if ("guardianEmail" in body) {
    const checked = checkOptionalGuardianEmail(
      readString(body, "guardianEmail"),
    );
    if (!checked.ok) {
      return checked;
    }
    value.guardianEmail = checked.value;
  }

  const changed = Object.keys(value).filter((key) => key !== "learnerId");
  if (changed.length === 0) {
    return { ok: false, message: "Provide at least one field to change." };
  }

  return { ok: true, value };
}

/** Parses an activation/deactivation body for one learner. */
export function parseLearnerStatusInput(
  body: unknown,
): ParseResult<LearnerStatusInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const learnerId = checkUuid(
    readString(body, "learnerId") ?? "",
    LEARNER_ID_MESSAGE,
  );
  if (!learnerId.ok) {
    return learnerId;
  }

  const status = readString(body, "status") ?? "";
  if (!isLearnerStatus(status)) {
    return { ok: false, message: "Choose a valid student status." };
  }

  return { ok: true, value: { learnerId: learnerId.value, status } };
}

/** Parses a body that names one learner, e.g. a detail read. */
export function parseLearnerIdInput(
  body: unknown,
): ParseResult<{ readonly learnerId: string }> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const learnerId = checkUuid(
    readString(body, "learnerId") ?? "",
    LEARNER_ID_MESSAGE,
  );
  if (!learnerId.ok) {
    return learnerId;
  }

  return { ok: true, value: { learnerId: learnerId.value } };
}

/** Parses a "change class placement" body: one learner and one target class. */
export function parsePlacementChangeInput(
  body: unknown,
): ParseResult<PlacementChangeInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const learnerId = checkUuid(
    readString(body, "learnerId") ?? "",
    LEARNER_ID_MESSAGE,
  );
  if (!learnerId.ok) {
    return learnerId;
  }

  const classId = checkUuid(
    readString(body, "classId") ?? "",
    CLASS_ID_MESSAGE,
  );
  if (!classId.ok) {
    return classId;
  }

  return {
    ok: true,
    value: { learnerId: learnerId.value, classId: classId.value },
  };
}
