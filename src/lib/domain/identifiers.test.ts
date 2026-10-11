import { describe, expect, it } from "vitest";

import {
  RESERVED_ACCOUNT_DOMAIN,
  buildInternalAccountIdentifier,
  isInternalStudentId,
  isReservedAccountIdentifier,
  isValidRegistrationNumber,
  isValidSchoolCode,
  normaliseRegistrationNumber,
  normaliseSchoolCode,
} from "./identifiers";

const VALID_UUID = "6f3a1c2e-8b4d-4f7a-9c1e-2d3b4a5c6d7e";

describe("internal student id", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(isInternalStudentId(VALID_UUID)).toBe(true);
    expect(isInternalStudentId("123")).toBe(false);
    expect(isInternalStudentId("not-a-uuid")).toBe(false);
  });
});

describe("school code", () => {
  it("normalises case, spaces and separators", () => {
    expect(normaliseSchoolCode(" gh-1234 ")).toBe("GH1234");
  });

  it("validates the unambiguous format", () => {
    expect(isValidSchoolCode("GH1234")).toBe(true);
    expect(isValidSchoolCode("gh 1234")).toBe(true);
    // Too short, and contains an excluded ambiguous letter.
    expect(isValidSchoolCode("GH1")).toBe(false);
    expect(isValidSchoolCode("GHIO12")).toBe(false);
  });
});

describe("registration number", () => {
  it("normalises whitespace and case for stable uniqueness", () => {
    expect(normaliseRegistrationNumber("  st- 001 ")).toBe("ST- 001");
  });

  it("requires a value and enforces a maximum length", () => {
    expect(isValidRegistrationNumber("A1")).toBe(true);
    expect(isValidRegistrationNumber("   ")).toBe(false);
    expect(isValidRegistrationNumber("x".repeat(33))).toBe(false);
  });
});

describe("internal account identifier", () => {
  it("builds an opaque identifier in the reserved domain", () => {
    const identifier = buildInternalAccountIdentifier(VALID_UUID);
    expect(identifier).toBe(`${VALID_UUID}@${RESERVED_ACCOUNT_DOMAIN}`);
  });

  it("refuses to build an identifier from an invalid student id", () => {
    expect(() => buildInternalAccountIdentifier("nope")).toThrow();
  });

  it("recognises only identifiers in the reserved domain", () => {
    expect(
      isReservedAccountIdentifier(buildInternalAccountIdentifier(VALID_UUID)),
    ).toBe(true);
    expect(isReservedAccountIdentifier(`${VALID_UUID}@example.com`)).toBe(
      false,
    );
    expect(isReservedAccountIdentifier("someone@students.invalid")).toBe(false);
  });
});
