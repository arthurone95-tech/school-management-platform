import { describe, expect, it } from "vitest";

import {
  parseClassCreateInput,
  parseClassUpdateInput,
  parseEnrolmentInput,
  parseLearnerCorrectionInput,
  parseLearnerIdInput,
  parseLearnerStatusFilter,
  parseLearnerStatusInput,
  parsePageParam,
  parsePlacementChangeInput,
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

const LEARNER_ID = "9c1e2d3b-4a5c-6d7e-8f90-1a2b3c4d5e6f";

describe("parseLearnerStatusFilter", () => {
  it("defaults to the active view for a missing or unrecognised value", () => {
    expect(parseLearnerStatusFilter(null)).toBe("active");
    expect(parseLearnerStatusFilter("")).toBe("active");
    expect(parseLearnerStatusFilter("all")).toBe("active");
    expect(parseLearnerStatusFilter("ACTIVE")).toBe("active");
  });

  it("accepts the explicit inactive view", () => {
    expect(parseLearnerStatusFilter("inactive")).toBe("inactive");
  });
});

describe("parseClassCreateInput", () => {
  it("accepts and trims a class name", () => {
    const result = parseClassCreateInput({ name: "  Primary 1  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Primary 1");
  });

  it("rejects a blank or over-long name and a non-object body", () => {
    expect(parseClassCreateInput({ name: "   " }).ok).toBe(false);
    expect(parseClassCreateInput({ name: "x".repeat(81) }).ok).toBe(false);
    expect(parseClassCreateInput({}).ok).toBe(false);
    expect(parseClassCreateInput(null).ok).toBe(false);
  });
});

describe("parseClassUpdateInput", () => {
  it("accepts a rename", () => {
    const result = parseClassUpdateInput({
      classId: CLASS_ID,
      name: "Primary 2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Primary 2");
    expect(result.value.isActive).toBeUndefined();
  });

  it("accepts an active flag", () => {
    const result = parseClassUpdateInput({
      classId: CLASS_ID,
      isActive: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isActive).toBe(false);
  });

  it("requires at least one change", () => {
    expect(parseClassUpdateInput({ classId: CLASS_ID }).ok).toBe(false);
  });

  it("rejects a bad class id or a non-boolean flag", () => {
    expect(parseClassUpdateInput({ classId: "primary-1", name: "X" }).ok).toBe(
      false,
    );
    expect(
      parseClassUpdateInput({ classId: CLASS_ID, isActive: "yes" }).ok,
    ).toBe(false);
  });
});

describe("parseLearnerCorrectionInput", () => {
  it("accepts a single corrected field", () => {
    const result = parseLearnerCorrectionInput({
      learnerId: LEARNER_ID,
      firstName: "  Ama  ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.firstName).toBe("Ama");
    expect(result.value.lastName).toBeUndefined();
  });

  it("treats an explicit null guardian email as clearing it", () => {
    const result = parseLearnerCorrectionInput({
      learnerId: LEARNER_ID,
      guardianEmail: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.guardianEmail).toBeNull();
  });

  it("treats a blank guardian email as clearing it", () => {
    const result = parseLearnerCorrectionInput({
      learnerId: LEARNER_ID,
      guardianEmail: "   ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.guardianEmail).toBeNull();
  });

  it("requires at least one field to change", () => {
    expect(parseLearnerCorrectionInput({ learnerId: LEARNER_ID }).ok).toBe(
      false,
    );
  });

  it("rejects a bad learner id and an invalid field value", () => {
    expect(
      parseLearnerCorrectionInput({ learnerId: "abc", firstName: "Ama" }).ok,
    ).toBe(false);
    expect(
      parseLearnerCorrectionInput({ learnerId: LEARNER_ID, gender: "unknown" })
        .ok,
    ).toBe(false);
    expect(
      parseLearnerCorrectionInput({
        learnerId: LEARNER_ID,
        dateOfBirth: "2999-01-01",
      }).ok,
    ).toBe(false);
  });
});

describe("parseLearnerStatusInput", () => {
  it("accepts the two learner states", () => {
    expect(
      parseLearnerStatusInput({ learnerId: LEARNER_ID, status: "inactive" }).ok,
    ).toBe(true);
    expect(
      parseLearnerStatusInput({ learnerId: LEARNER_ID, status: "active" }).ok,
    ).toBe(true);
  });

  it("rejects any other status", () => {
    expect(
      parseLearnerStatusInput({ learnerId: LEARNER_ID, status: "removed" }).ok,
    ).toBe(false);
    expect(parseLearnerStatusInput({ learnerId: LEARNER_ID }).ok).toBe(false);
  });
});

describe("parseLearnerIdInput", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(parseLearnerIdInput({ learnerId: LEARNER_ID }).ok).toBe(true);
    expect(parseLearnerIdInput({ learnerId: "nope" }).ok).toBe(false);
    expect(parseLearnerIdInput({}).ok).toBe(false);
  });
});

describe("parsePlacementChangeInput", () => {
  it("accepts a learner and class pair", () => {
    const result = parsePlacementChangeInput({
      learnerId: LEARNER_ID,
      classId: CLASS_ID,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a missing or malformed id", () => {
    expect(
      parsePlacementChangeInput({ learnerId: LEARNER_ID, classId: "one" }).ok,
    ).toBe(false);
    expect(parsePlacementChangeInput({ learnerId: LEARNER_ID }).ok).toBe(false);
    expect(parsePlacementChangeInput({ classId: CLASS_ID }).ok).toBe(false);
  });
});
