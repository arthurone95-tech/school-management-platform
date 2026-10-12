/**
 * Request parsing and validation for the student portal endpoints.
 *
 * Pure and isomorphic (no Node-only or database imports) so the rules are
 * unit-tested without a database. These helpers only decide whether a request
 * is well formed; authorization and account lookup happen in trusted server
 * code (`docs/ENROLMENT_PERMISSION_MODEL.md` 8.4, D-020).
 */

import {
  ACTIVATION_CODE_MIN_LENGTH,
  isValidActivationCodeShape,
  normaliseActivationCode,
} from "@/lib/domain/activation";
import {
  isValidSchoolCode,
  normaliseSchoolCode,
} from "@/lib/domain/identifiers";
import { isValidUsername, USERNAME_MAX_LENGTH } from "@/lib/domain/username";

/** Interim minimum for a student-chosen password. */
export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound accepted from a client; bcrypt ignores bytes beyond 72. */
export const PASSWORD_MAX_LENGTH = 72;

export const SCHOOL_CODE_MAX_LENGTH = 10;

export interface SignInInput {
  readonly schoolCode: string;
  readonly username: string;
  readonly password: string;
}

export interface ActivateInput {
  readonly code: string;
  readonly newPassword: string;
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" ? value : null;
}

function invalidPasswordMessage(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Your password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Your password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function parseSignInInput(body: unknown): ParseResult<SignInInput> {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Enter your school code, username and password.",
    };
  }

  const rawCode = readString(body, "schoolCode");
  const rawUsername = readString(body, "username");
  const password = readString(body, "password");

  if (rawCode === null || rawUsername === null || password === null) {
    return {
      ok: false,
      message: "Enter your school code, username and password.",
    };
  }

  const schoolCode = normaliseSchoolCode(rawCode);
  if (!isValidSchoolCode(schoolCode)) {
    return {
      ok: false,
      message: "School code or username or password is incorrect.",
    };
  }

  const username = rawUsername.trim().toLowerCase();
  if (
    username.length === 0 ||
    username.length > USERNAME_MAX_LENGTH ||
    !isValidUsername(username)
  ) {
    return {
      ok: false,
      message: "School code or username or password is incorrect.",
    };
  }

  if (password.length === 0 || password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      message: "School code or username or password is incorrect.",
    };
  }

  return { ok: true, value: { schoolCode, username, password } };
}

export function parseActivateInput(body: unknown): ParseResult<ActivateInput> {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Enter your activation code and a new password.",
    };
  }

  const rawCode = readString(body, "code");
  const newPassword = readString(body, "newPassword");
  const confirmPassword = readString(body, "confirmPassword");

  if (rawCode === null || newPassword === null || confirmPassword === null) {
    return {
      ok: false,
      message: "Enter your activation code and a new password.",
    };
  }

  const code = normaliseActivationCode(rawCode);
  if (
    code.length < ACTIVATION_CODE_MIN_LENGTH ||
    !isValidActivationCodeShape(code)
  ) {
    return {
      ok: false,
      message:
        "That activation code is not valid or has expired. Ask your school for a new one.",
    };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, message: "The two passwords do not match." };
  }

  const passwordProblem = invalidPasswordMessage(newPassword);
  if (passwordProblem) {
    return { ok: false, message: passwordProblem };
  }

  return { ok: true, value: { code, newPassword } };
}

/** Uniform message for any failed sign-in, so responses do not reveal which part was wrong. */
export const SIGN_IN_FAILURE_MESSAGE =
  "School code or username or password is incorrect.";

/** Uniform message for any failed activation, so responses do not reveal which part was wrong. */
export const ACTIVATION_FAILURE_MESSAGE =
  "That activation code is not valid or has already been used or has expired. Ask your school for a new one.";

export { ACTIVATION_CODE_MIN_LENGTH };
