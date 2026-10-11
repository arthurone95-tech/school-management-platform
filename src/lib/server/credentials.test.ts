import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CREDENTIAL_HASH_HEX_LENGTH,
  MissingCredentialSecretError,
  generateCredentialSecret,
  hashCredential,
  verifyCredential,
} from "./credentials";

const SECRET = "test-secret-value-that-is-at-least-32-characters-long";

beforeEach(() => {
  vi.stubEnv("PORTAL_CREDENTIAL_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hashCredential", () => {
  it("produces a 64-character lower-case hex digest", () => {
    const hash = hashCredential("ACDEFGHJKMNPQRTU");
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).toHaveLength(CREDENTIAL_HASH_HEX_LENGTH);
  });

  it("is deterministic and case/format insensitive", () => {
    const a = hashCredential("ACDE-FGHJ-KMNP-QRTU");
    const b = hashCredential("acdefghj kmnpqrtu");
    expect(a).toBe(b);
  });

  it("depends on the secret", () => {
    const withDefault = hashCredential("ACDEFGHJKMNPQRTU");
    const withOther = hashCredential("ACDEFGHJKMNPQRTU", "x".repeat(32));
    expect(withDefault).not.toBe(withOther);
  });

  it("throws a safe error when the secret is missing or too short", () => {
    vi.stubEnv("PORTAL_CREDENTIAL_SECRET", "");
    expect(() => hashCredential("ACDEFGHJKMNPQRTU")).toThrow(
      MissingCredentialSecretError,
    );

    vi.stubEnv("PORTAL_CREDENTIAL_SECRET", "too-short");
    expect(() => hashCredential("ACDEFGHJKMNPQRTU")).toThrow(
      MissingCredentialSecretError,
    );
  });
});

describe("verifyCredential", () => {
  it("accepts the matching code regardless of formatting", () => {
    const stored = hashCredential("ACDEFGHJKMNPQRTU");
    expect(verifyCredential("ACDE-FGHJ-KMNP-QRTU", stored)).toBe(true);
    expect(verifyCredential("acdefghjkmnpqrtu", stored)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const stored = hashCredential("ACDEFGHJKMNPQRTU");
    expect(verifyCredential("ACDEFGHJKMNPQRT3", stored)).toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyCredential("ACDEFGHJKMNPQRTU", "")).toBe(false);
    expect(verifyCredential("ACDEFGHJKMNPQRTU", "not-a-hash")).toBe(false);
    expect(verifyCredential("ACDEFGHJKMNPQRTU", "a".repeat(63))).toBe(false);
  });
});

describe("generateCredentialSecret", () => {
  it("returns at least the minimum length and is random", () => {
    const first = generateCredentialSecret();
    const second = generateCredentialSecret();
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(first).not.toBe(second);
    expect(() => hashCredential("ACDEFGHJKMNPQRTU", first)).not.toThrow();
  });
});
