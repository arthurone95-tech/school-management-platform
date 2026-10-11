import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { normaliseActivationCode } from "@/lib/domain/activation";

/**
 * Hashing for one-time activation and reset credentials
 * (`docs/ENROLMENT_PERMISSION_MODEL.md` 8.2, D-019).
 *
 * Only a hash is ever stored (`learner_portal_credentials.credential_hash`);
 * the raw code is shown to the administrator once at issuance and never again.
 *
 * The hash is a keyed HMAC-SHA256 rather than a per-row salted digest, because
 * the student supplies only the code: the server must look the credential up by
 * its hash, so the mapping has to be deterministic. The key
 * (`PORTAL_CREDENTIAL_SECRET`) means a leaked database alone is not enough to
 * test candidate codes offline. Codes are already high-entropy (16 characters
 * from a 29-symbol alphabet), so this is defence in depth, not the primary
 * control. Stored values are 64-character lower-case hex.
 *
 * This module is server-only. It must never be imported into browser code.
 */

const MIN_SECRET_LENGTH = 32;
const SECRET_BYTES = 32;
const HASH_HEX_LENGTH = 64;

export class MissingCredentialSecretError extends Error {
  constructor() {
    super(
      "PORTAL_CREDENTIAL_SECRET is not configured or is too short. Set a random " +
        "value of at least 32 characters in the server environment (see .env.example). " +
        "Never prefix it with NEXT_PUBLIC_.",
    );
    this.name = "MissingCredentialSecretError";
  }
}

function readSecret(): string {
  const secret = process.env.PORTAL_CREDENTIAL_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new MissingCredentialSecretError();
  }
  return secret;
}

/**
 * Hashes a credential code for storage or lookup. The code is normalised first,
 * so dashes, spaces and case do not change the result.
 */
export function hashCredential(
  code: string,
  secret: string = readSecret(),
): string {
  return createHmac("sha256", secret)
    .update(normaliseActivationCode(code), "utf8")
    .digest("hex");
}

/**
 * Constant-time comparison of a submitted code against a stored hash. Returns
 * `false` for a malformed or absent hash rather than throwing, so a corrupt row
 * cannot be distinguished from a wrong code by the caller's behaviour.
 */
export function verifyCredential(
  code: string,
  storedHash: string,
  secret: string = readSecret(),
): boolean {
  if (typeof storedHash !== "string" || !/^[0-9a-f]{64}$/.test(storedHash)) {
    return false;
  }

  const candidate = Buffer.from(hashCredential(code, secret), "utf8");
  const expected = Buffer.from(storedHash, "utf8");
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}

/**
 * Generates a random secret suitable for `PORTAL_CREDENTIAL_SECRET`. Used to
 * provision a project's environment; not called at request time.
 */
export function generateCredentialSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}

/** Exposed for tests that assert the stored shape. */
export const CREDENTIAL_HASH_HEX_LENGTH = HASH_HEX_LENGTH;
