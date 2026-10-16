/**
 * Shareable staff invitation link rules (D-025).
 *
 * Pure and isomorphic — no Node-only or database imports — so the rules are
 * unit-tested without a database and reused by the browser acceptance form that
 * reads the credential out of the URL fragment.
 *
 * The credential is a **bearer secret**: like a Supabase magic link, whoever
 * holds the link can accept the invitation once. Alongside the student portal
 * credential rules (`src/lib/domain/activation.ts`), only a hash of it is ever
 * stored (`src/lib/server/staff-invitations.ts`), it is never logged, and it is
 * deliberately carried in the URL **fragment** so an ordinary HTTP request —
 * and therefore a server, proxy or analytics access log — never receives it.
 */

import { DEFAULT_ACTIVATION_TTL_HOURS } from "@/lib/domain/activation";

/**
 * Invitation link lifetime, in hours. Reuses the platform's existing 72-hour
 * activation default rather than introducing a second expiry policy.
 */
export const STAFF_INVITATION_TTL_HOURS = DEFAULT_ACTIVATION_TTL_HOURS;

/** Random bytes behind one invitation token (256 bits). */
export const INVITATION_TOKEN_BYTES = 32;

/** Hex characters in a serialised invitation token. */
export const INVITATION_TOKEN_LENGTH = INVITATION_TOKEN_BYTES * 2;

const INVITATION_TOKEN_PATTERN = new RegExp(
  `^[0-9a-f]{${INVITATION_TOKEN_LENGTH}}$`,
);

/** The acceptance page and the fragment parameter that carries the token. */
export const STAFF_INVITATION_PATH = "/join";
export const INVITATION_TOKEN_PARAM = "token";

/**
 * Generates a cryptographically random invitation token (lower-case hex).
 *
 * The token is a URL-safe, human-transcribable string: hex survives the
 * credential normalisation used for hashing unchanged, so no character can be
 * lost between issue and acceptance.
 */
export function generateInvitationToken(): string {
  const bytes = new Uint8Array(INVITATION_TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Shape check only. A value that passes is well formed; it is not thereby
 * valid — the server still resolves the hash, expiry, revocation and single-use
 * state before an invitation is accepted.
 */
export function isValidInvitationTokenShape(value: unknown): value is string {
  return typeof value === "string" && INVITATION_TOKEN_PATTERN.test(value);
}

/**
 * Builds the shareable link an administrator copies or shares out of band.
 *
 * The credential is placed in the URL fragment (after `#`), which browsers
 * never send to the server, so it stays out of request lines, access logs,
 * `Referer` headers and server-side error reports.
 */
export function buildStaffInvitationLink(
  origin: string,
  token: string,
): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${STAFF_INVITATION_PATH}#${INVITATION_TOKEN_PARAM}=${token}`;
}

/**
 * Reads the credential out of a URL fragment such as `#token=<hex>`.
 * Returns `null` for anything else, so the caller can treat a malformed or
 * missing fragment as an invalid link without contacting the server.
 */
export function parseInvitationTokenFragment(fragment: string): string | null {
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!raw) {
    return null;
  }
  const value = new URLSearchParams(raw).get(INVITATION_TOKEN_PARAM);
  return isValidInvitationTokenShape(value) ? value : null;
}
