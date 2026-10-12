/**
 * Request parsing and validation for the staff endpoints.
 *
 * Pure and isomorphic (no Node-only or database imports) so the rules are
 * unit-tested without a database. These helpers only decide whether a request
 * is well formed; authentication, school membership and permission checks
 * happen in trusted server code (docs/DECISIONS.md D-021, D-024).
 */

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/portal/requests";

/** Longest address accepted for a staff invitation or sign-in. */
export const EMAIL_MAX_LENGTH = 254;

/**
 * The school-scoped staff roles approved in D-021. Platform Owner is
 * platform-level (not a school membership role) and is handled separately, so
 * it is deliberately not accepted here.
 */
export const STAFF_ROLES = ["school_administrator", "teacher"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export interface StaffSignInInput {
  readonly email: string;
  readonly password: string;
}

export interface StaffInviteInput {
  readonly email: string;
  readonly role: StaffRole;
}

export interface StaffSetPasswordInput {
  readonly password: string;
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

/** Minimal address shape; real deliverability is decided by Supabase Auth. */
function isEmailLike(value: string): boolean {
  if (value.length === 0 || value.length > EMAIL_MAX_LENGTH) {
    return false;
  }
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) {
    return false;
  }
  if (value.slice(at + 1).indexOf(".") === -1) {
    return false;
  }
  return true;
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseStaffSignInInput(
  body: unknown,
): ParseResult<StaffSignInInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Enter your email and password." };
  }

  const rawEmail = readString(body, "email");
  const password = readString(body, "password");

  if (rawEmail === null || password === null) {
    return { ok: false, message: "Enter your email and password." };
  }

  const email = normaliseEmail(rawEmail);
  if (!isEmailLike(email)) {
    return { ok: false, message: STAFF_SIGN_IN_FAILURE_MESSAGE };
  }

  if (password.length === 0 || password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: STAFF_SIGN_IN_FAILURE_MESSAGE };
  }

  return { ok: true, value: { email, password } };
}

export function parseStaffInviteInput(
  body: unknown,
): ParseResult<StaffInviteInput> {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Enter the email address and role for the invitation.",
    };
  }

  const rawEmail = readString(body, "email");
  const role = readString(body, "role");

  if (rawEmail === null || role === null) {
    return {
      ok: false,
      message: "Enter the email address and role for the invitation.",
    };
  }

  const email = normaliseEmail(rawEmail);
  if (!isEmailLike(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (!isStaffRole(role)) {
    return { ok: false, message: "Choose a valid staff role." };
  }

  return { ok: true, value: { email, role } };
}

export function parseStaffSetPasswordInput(
  body: unknown,
): ParseResult<StaffSetPasswordInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Choose a password." };
  }

  const password = readString(body, "password");

  if (password === null) {
    return { ok: false, message: "Choose a password." };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Your password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      message: `Your password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, value: { password } };
}

/** Uniform message for any failed staff sign-in. */
export const STAFF_SIGN_IN_FAILURE_MESSAGE = "Email or password is incorrect.";
