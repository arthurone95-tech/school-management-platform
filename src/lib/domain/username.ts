/**
 * Student username rules.
 *
 * Usernames are generated from the student's name and must be unique within
 * their school, because sign-in takes a school code together with the username
 * (`docs/ENROLMENT_PERMISSION_MODEL.md` 7.3, D-020). These helpers are pure and
 * isomorphic; collision resolution against the database is a caller concern.
 */

export const USERNAME_MAX_LENGTH = 32;

const USERNAME_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;

/**
 * Letters specific to Ghanaian languages that do not decompose under NFKD.
 * Mapped to their closest Latin equivalents so names such as `Kwabɛna` produce
 * a stable ASCII username instead of dropping the letter.
 */
const LETTER_TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ɛ: "e",
  ɔ: "o",
  ʋ: "v",
  ŋ: "n",
  ɖ: "d",
  ƒ: "f",
};

/**
 * Lower-cases and strips diacritics, then removes any remaining non
 * alphanumeric characters. `Kojo Osei-Bonsu` -> `kojooseibonsu`.
 */
export function slugPart(value: string): string {
  const decomposed = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  let transliterated = "";
  for (const character of decomposed) {
    transliterated += LETTER_TRANSLITERATIONS[character] ?? character;
  }

  return transliterated.replace(/[^a-z0-9]+/g, "");
}

/**
 * Builds the base username (`first.last`) before collision resolution. Returns
 * `student` when the first name yields nothing usable.
 */
export function deriveUsernameBase(
  firstName: string,
  lastName: string,
): string {
  const first = slugPart(firstName) || "student";
  const last = slugPart(lastName);
  const base = last ? `${first}.${last}` : first;
  return base.slice(0, USERNAME_MAX_LENGTH);
}

/**
 * Appends a numeric suffix for a collision. `index` is zero-based, so the first
 * collision produces `<base>2`, the next `<base>3`, and so on.
 */
export function usernameWithSuffix(base: string, index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(
      "Username collision index must be a non-negative integer",
    );
  }
  if (index === 0) {
    return base;
  }

  const suffix = String(index + 1);
  const trimmed = base.slice(0, USERNAME_MAX_LENGTH - suffix.length);
  return `${trimmed}${suffix}`;
}

export function isValidUsername(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(value)
  );
}
