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

  const rawRegistration = readString(body, "registrationNumber");
  if (rawRegistration === null || !isValidRegistrationNumber(rawRegistration)) {
    return {
      ok: false,
      message: `Enter a registration number (1–${REGISTRATION_NUMBER_MAX_LENGTH} characters).`,
    };
  }

  const firstName = readString(body, "firstName") ?? "";
  if (!trimmedLengthValid(firstName, NAME_MAX_LENGTH)) {
    return { ok: false, message: "Enter the student's first name." };
  }

  const lastName = readString(body, "lastName") ?? "";
  if (!trimmedLengthValid(lastName, NAME_MAX_LENGTH)) {
    return { ok: false, message: "Enter the student's last name." };
  }

  const gender = readString(body, "gender");
  if (gender === null || !isGender(gender)) {
    return { ok: false, message: "Choose the student's gender." };
  }

  const dateOfBirth = readString(body, "dateOfBirth") ?? "";
  if (!isRealCalendarDate(dateOfBirth)) {
    return {
      ok: false,
      message: "Enter a valid date of birth in YYYY-MM-DD form.",
    };
  }
  if (dateOfBirth > utcToday(now)) {
    return { ok: false, message: "The date of birth cannot be in the future." };
  }
  if (dateOfBirth < EARLIEST_DATE_OF_BIRTH) {
    return {
      ok: false,
      message: `Enter a date of birth on or after ${EARLIEST_DATE_OF_BIRTH}.`,
    };
  }

  const residentialAddress = readString(body, "residentialAddress") ?? "";
  if (!trimmedLengthValid(residentialAddress, ADDRESS_MAX_LENGTH)) {
    return {
      ok: false,
      message: `Enter the student's residential address (1–${ADDRESS_MAX_LENGTH} characters).`,
    };
  }

  const guardianPhone = readString(body, "guardianPhone") ?? "";
  if (!trimmedLengthValid(guardianPhone, GUARDIAN_PHONE_MAX_LENGTH)) {
    return {
      ok: false,
      message: `Enter a guardian phone number (1–${GUARDIAN_PHONE_MAX_LENGTH} characters).`,
    };
  }

  // Optional: an absent, blank or whitespace-only value means "not provided".
  const rawEmail = readString(body, "guardianEmail");
  let guardianEmail: string | null = null;
  if (rawEmail !== null && rawEmail.trim().length > 0) {
    const normalised = normaliseEmail(rawEmail);
    if (!isEmailLike(normalised)) {
      return {
        ok: false,
        message: "Enter a valid guardian email address, or leave it blank.",
      };
    }
    guardianEmail = normalised;
  }

  const classId = readString(body, "classId");
  if (classId === null || !UUID_PATTERN.test(classId.trim())) {
    return { ok: false, message: "Choose a class for the student." };
  }

  return {
    ok: true,
    value: {
      registrationNumber: normaliseRegistrationNumber(rawRegistration),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      dateOfBirth,
      residentialAddress: residentialAddress.trim(),
      guardianPhone: guardianPhone.trim(),
      guardianEmail,
      classId: classId.trim(),
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
