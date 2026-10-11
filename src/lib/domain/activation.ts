/**
 * Student activation and one-time reset credential rules.
 *
 * Approved by `docs/ENROLMENT_PERMISSION_MODEL.md` 8.2 and 8.3. These helpers
 * are pure except for `generateActivationCode`, which reads randomness from the
 * platform `crypto` global and is therefore usable on the server and in tests.
 *
 * Storage rules (hashing, single-use marking, revocation) live in server code:
 * only a hash of the credential is ever stored, and it is never logged or shown
 * again after issue.
 */

/** Initial default expiry of an activation or reset credential, in hours. */
export const DEFAULT_ACTIVATION_TTL_HOURS = 72;

export const ACTIVATION_CODE_MIN_LENGTH = 8;
export const ACTIVATION_CODE_MAX_LENGTH = 64;
export const DEFAULT_ACTIVATION_CODE_LENGTH = 16;

/**
 * Unambiguous alphabet: omits `I`, `L`, `O`, `S`, `Z`, `0` and `1` so a code
 * read aloud or copied by hand is not confused with a similar-looking
 * character.
 */
const ACTIVATION_ALPHABET = "ABCDEFGHJKMNPQRTUVWXY23456789";

/**
 * Generates a cryptographically random activation code using rejection
 * sampling, so every character is uniformly distributed (a plain `%` would
 * bias the first characters of the alphabet).
 */
export function generateActivationCode(
  length: number = DEFAULT_ACTIVATION_CODE_LENGTH,
): string {
  if (
    !Number.isInteger(length) ||
    length < ACTIVATION_CODE_MIN_LENGTH ||
    length > ACTIVATION_CODE_MAX_LENGTH
  ) {
    throw new RangeError(
      `Activation code length must be an integer between ${ACTIVATION_CODE_MIN_LENGTH} and ${ACTIVATION_CODE_MAX_LENGTH}`,
    );
  }

  const alphabetSize = ACTIVATION_ALPHABET.length;
  const rejectionLimit = 256 - (256 % alphabetSize);

  let code = "";
  while (code.length < length) {
    // Read a few extra bytes to reduce the number of loop iterations.
    const bytes = new Uint8Array(length - code.length + 8);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= rejectionLimit) {
        continue;
      }
      code += ACTIVATION_ALPHABET[byte % alphabetSize];
      if (code.length === length) {
        break;
      }
    }
  }

  return code;
}

/**
 * Normalises a code the way a student or administrator might type it: removes
 * separators, ignores case and strips surrounding whitespace, so the stored
 * hash matches regardless of presentation.
 */
export function normaliseActivationCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Groups a code into blocks of four for readability (`ACDE-FGHJ-KMNP`). Purely
 * presentational; never derive the stored value from a formatted code.
 */
export function formatActivationCode(code: string, groupSize = 4): string {
  if (!Number.isInteger(groupSize) || groupSize < 1) {
    throw new RangeError("Group size must be a positive integer");
  }
  const normalised = normaliseActivationCode(code);
  return normalised
    .replace(new RegExp(`(.{${groupSize}})`, "g"), "$1-")
    .replace(/-$/, "");
}

export function isValidActivationCodeShape(value: string): boolean {
  const normalised = normaliseActivationCode(value);
  return (
    normalised.length >= ACTIVATION_CODE_MIN_LENGTH &&
    normalised.length <= ACTIVATION_CODE_MAX_LENGTH &&
    [...normalised].every((character) =>
      ACTIVATION_ALPHABET.includes(character),
    )
  );
}

export function activationExpiry(
  issuedAt: Date,
  ttlHours: number = DEFAULT_ACTIVATION_TTL_HOURS,
): Date {
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
    throw new RangeError(
      "Activation expiry must be a positive number of hours",
    );
  }
  return new Date(issuedAt.getTime() + ttlHours * 60 * 60 * 1000);
}

export interface ActivationCredentialState {
  readonly expiresAt: Date;
  readonly usedAt?: Date | null;
  readonly revokedAt?: Date | null;
}

/**
 * A credential is usable only if it has not been used, not been revoked, and
 * has not expired (`docs/ENROLMENT_PERMISSION_MODEL.md` 8.2).
 */
export function isActivationUsable(
  state: ActivationCredentialState,
  now: Date = new Date(),
): boolean {
  if (state.usedAt) {
    return false;
  }
  if (state.revokedAt) {
    return false;
  }
  return now.getTime() < state.expiresAt.getTime();
}
