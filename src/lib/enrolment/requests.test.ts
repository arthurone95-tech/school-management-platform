import { describe, expect, it } from "vitest";

import {
  parseEnrolmentInput,
  parsePageParam,
  utcToday,
  LEARNER_PAGE_SIZE,
} from "./requests";

const CLASS_ID = "6f3a1c2e-8b4d-4f7a-9c1e-2d3b4a5c6d7e";

/** A complete, valid enrolment body; tests override single fields. */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    registrationNumber: "alpha-002",
    firstName: "Kofi",
    lastName: "Boateng",
    gender: "male",
    dateOfBirth: "2015-04-09",
    residentialAddress: "12 Ring Road, Accra",
    guardianPhone: "+233200000001",
    guardianEmail: "guardian@example.com",
    classId: CLASS_ID,
    ...overrides,
  };
}

describe("parseEnrolmentInput", () => {
  it("accepts a complete body and normalises the stored values", () => {
    const result = parseEnrolmentInput(validBody());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.registrationNumber).toBe("ALPHA-002");
    expect(result.value.firstName).toBe("Kofi");
    expect(result.value.gender).toBe("male");
    expect(result.value.guardianEmail).toBe("guardian@example.com");
    expect(result.value.classId).toBe(CLASS_ID);
  });

  it("treats a blank guardian email as not provided", () => {
    const result = parseEnrolmentInput(validBody({ guardianEmail: "   " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.guardianEmail).toBeNull();
  });

  it("rejects a non-object body", () => {
    expect(parseEnrolmentInput(null).ok).toBe(false);
    expect(parseEnrolmentInput("nope").ok).toBe(false);
    expect(parseEnrolmentInput([]).ok).toBe(false);
  });

  it("requires a registration number", () => {
    expect(
      parseEnrolmentInput(validBody({ registrationNumber: "  " })).ok,
    ).toBe(false);
  });

  it("requires first and last names", () => {
    expect(parseEnrolmentInput(validBody({ firstName: " " })).ok).toBe(false);
    expect(parseEnrolmentInput(validBody({ lastName: "" })).ok).toBe(false);
    expect(
      parseEnrolmentInput(validBody({ firstName: "x".repeat(81) })).ok,
    ).toBe(false);
  });

  it("requires a known gender", () => {
    expect(parseEnrolmentInput(validBody({ gender: "unknown" })).ok).toBe(
      false,
    );
    expect(parseEnrolmentInput(validBody({ gender: "FEMALE" })).ok).toBe(false);
  });

  it("requires a real calendar date of birth", () => {
    expect(
      parseEnrolmentInput(validBody({ dateOfBirth: "2026-02-30" })).ok,
    ).toBe(false);
    expect(
      parseEnrolmentInput(validBody({ dateOfBirth: "09/04/2015" })).ok,
    ).toBe(false);
  });

  it("rejects a future date of birth", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const result = parseEnrolmentInput(
      validBody({ dateOfBirth: "2026-06-02" }),
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a date of birth of today", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    expect(
      parseEnrolmentInput(validBody({ dateOfBirth: "2026-06-01" }), now).ok,
    ).toBe(true);
  });

  it("rejects an implausibly early date of birth", () => {
    expect(
      parseEnrolmentInput(validBody({ dateOfBirth: "1899-12-31" })).ok,
    ).toBe(false);
  });

  it("requires an address and a guardian phone", () => {
    expect(parseEnrolmentInput(validBody({ residentialAddress: " " })).ok).toBe(
      false,
    );
    expect(parseEnrolmentInput(validBody({ guardianPhone: "" })).ok).toBe(
      false,
    );
  });

  it("rejects a malformed guardian email but allows it to be omitted", () => {
    expect(
      parseEnrolmentInput(validBody({ guardianEmail: "not-an-email" })).ok,
    ).toBe(false);
    expect(
      parseEnrolmentInput(validBody({ guardianEmail: undefined })).ok,
    ).toBe(true);
  });

  it("requires a UUID class id", () => {
    expect(parseEnrolmentInput(validBody({ classId: "primary-1" })).ok).toBe(
      false,
    );
    expect(parseEnrolmentInput(validBody({ classId: undefined })).ok).toBe(
      false,
    );
  });
});

describe("utcToday", () => {
  it("returns the date portion in UTC", () => {
    expect(utcToday(new Date("2026-06-01T23:30:00.000Z"))).toBe("2026-06-01");
  });
});

describe("parsePageParam", () => {
  it("defaults to page 1 for missing or invalid values", () => {
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
  });

  it("accepts a positive integer and caps it", () => {
    expect(parsePageParam("4")).toBe(4);
    expect(parsePageParam("999999999")).toBe(10000);
  });
});

describe("paging constant", () => {
  it("keeps a bounded page size", () => {
    expect(LEARNER_PAGE_SIZE).toBeGreaterThan(0);
    expect(LEARNER_PAGE_SIZE).toBeLessThanOrEqual(100);
  });
});
