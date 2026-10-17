import { describe, expect, it } from "vitest";

import {
  parseAcademicYearCreateInput,
  parseAcademicYearUpdateInput,
  parseAssignmentCreateInput,
  parseAssignmentDeleteInput,
  parseMemberStatusInput,
  parseSchoolProfileUpdateInput,
  parseSubjectCreateInput,
  parseSubjectUpdateInput,
  parseTermCreateInput,
  parseTermUpdateInput,
} from "./requests";

/**
 * Unit tests for the Phase 3 administration request parsers (D-029). These
 * mirror the database constraints (lengths, date order) but not the policy
 * checks; those are exercised in `tests/database`.
 */

const ID = "8f3a1c2d-4b5e-4f60-8a9b-0c1d2e3f4a5b";
const OTHER_ID = "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9";

describe("parseSchoolProfileUpdateInput", () => {
  it("accepts and trims a normal name", () => {
    const result = parseSchoolProfileUpdateInput({ name: "  Alpha Basic  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Alpha Basic");
  });

  it("rejects a missing or too-short name", () => {
    expect(parseSchoolProfileUpdateInput({ name: "   " }).ok).toBe(false);
    expect(parseSchoolProfileUpdateInput({ name: "A" }).ok).toBe(false);
  });

  it("rejects an over-long name and a non-object body", () => {
    expect(parseSchoolProfileUpdateInput({ name: "x".repeat(121) }).ok).toBe(
      false,
    );
    expect(parseSchoolProfileUpdateInput(null).ok).toBe(false);
    expect(parseSchoolProfileUpdateInput([]).ok).toBe(false);
  });
});

describe("parseAcademicYearCreateInput", () => {
  const valid = {
    name: "2026/2027",
    startsOn: "2026-09-01",
    endsOn: "2027-07-31",
  };

  it("accepts a valid year", () => {
    const result = parseAcademicYearCreateInput(valid);
    expect(result.ok).toBe(true);
  });

  it("requires both dates in ISO form", () => {
    expect(parseAcademicYearCreateInput({ ...valid, startsOn: "" }).ok).toBe(
      false,
    );
    expect(
      parseAcademicYearCreateInput({ ...valid, startsOn: "01/09/2026" }).ok,
    ).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    expect(
      parseAcademicYearCreateInput({ ...valid, endsOn: "2027-02-30" }).ok,
    ).toBe(false);
  });

  it("rejects an end before the start", () => {
    const result = parseAcademicYearCreateInput({
      ...valid,
      startsOn: "2026-09-01",
      endsOn: "2026-08-31",
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseAcademicYearUpdateInput", () => {
  it("accepts marking a year current", () => {
    const result = parseAcademicYearUpdateInput({
      academicYearId: ID,
      isCurrent: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isCurrent).toBe(true);
  });

  it("requires a uuid id", () => {
    expect(
      parseAcademicYearUpdateInput({ academicYearId: "nope", name: "X" }).ok,
    ).toBe(false);
  });

  it("rejects a body with no change", () => {
    expect(parseAcademicYearUpdateInput({ academicYearId: ID }).ok).toBe(false);
  });

  it("still guards the order when both dates are supplied", () => {
    expect(
      parseAcademicYearUpdateInput({
        academicYearId: ID,
        startsOn: "2027-01-01",
        endsOn: "2026-12-31",
      }).ok,
    ).toBe(false);
  });
});

describe("parseTermCreateInput", () => {
  const valid = {
    academicYearId: ID,
    name: "Term 1",
    startsOn: "2026-09-01",
    endsOn: "2026-12-15",
  };

  it("accepts a valid term", () => {
    const result = parseTermCreateInput(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.academicYearId).toBe(ID);
  });

  it("rejects a missing year id or a bad name", () => {
    expect(parseTermCreateInput({ ...valid, academicYearId: "" }).ok).toBe(
      false,
    );
    expect(parseTermCreateInput({ ...valid, name: "  " }).ok).toBe(false);
  });

  it("rejects an end before the start", () => {
    expect(
      parseTermCreateInput({
        ...valid,
        startsOn: "2026-09-10",
        endsOn: "2026-09-01",
      }).ok,
    ).toBe(false);
  });
});

describe("parseTermUpdateInput", () => {
  it("accepts a rename and dates", () => {
    const result = parseTermUpdateInput({
      termId: ID,
      name: "First term",
      startsOn: "2026-09-01",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a body with no change and a bad id", () => {
    expect(parseTermUpdateInput({ termId: ID }).ok).toBe(false);
    expect(parseTermUpdateInput({ termId: "not-a-uuid", name: "X" }).ok).toBe(
      false,
    );
  });
});

describe("parseSubjectCreateInput", () => {
  it("accepts a name and an optional code", () => {
    const result = parseSubjectCreateInput({ name: "Mathematics" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toBeNull();
  });

  it("trims and keeps a code; a blank code clears it", () => {
    const withCode = parseSubjectCreateInput({
      name: "English",
      code: "  ENG  ",
    });
    expect(withCode.ok).toBe(true);
    if (withCode.ok) {
      expect(withCode.value.code).toBe("ENG");
    }

    const blank = parseSubjectCreateInput({ name: "English", code: "   " });
    expect(blank.ok).toBe(true);
    if (blank.ok) {
      expect(blank.value.code).toBeNull();
    }
  });

  it("rejects a missing name and an over-long code", () => {
    expect(parseSubjectCreateInput({ name: "  " }).ok).toBe(false);
    expect(
      parseSubjectCreateInput({ name: "English", code: "x".repeat(21) }).ok,
    ).toBe(false);
  });
});

describe("parseSubjectUpdateInput", () => {
  it("accepts a bare activation toggle", () => {
    const result = parseSubjectUpdateInput({
      subjectId: ID,
      isActive: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isActive).toBe(false);
  });

  it("accepts clearing the code with null", () => {
    const result = parseSubjectUpdateInput({ subjectId: ID, code: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toBeNull();
  });

  it("rejects no change, a bad id and a non-boolean flag", () => {
    expect(parseSubjectUpdateInput({ subjectId: ID }).ok).toBe(false);
    expect(parseSubjectUpdateInput({ subjectId: "x", name: "Y" }).ok).toBe(
      false,
    );
    expect(parseSubjectUpdateInput({ subjectId: ID, isActive: "yes" }).ok).toBe(
      false,
    );
  });
});

describe("parseMemberStatusInput", () => {
  it("accepts each approved action", () => {
    for (const action of ["suspend", "restore", "revoke"] as const) {
      const result = parseMemberStatusInput({ membershipId: ID, action });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.action).toBe(action);
      }
    }
  });

  it("rejects an unknown action and a non-uuid id", () => {
    expect(
      parseMemberStatusInput({ membershipId: ID, action: "delete" }).ok,
    ).toBe(false);
    expect(
      parseMemberStatusInput({ membershipId: "x", action: "suspend" }),
    ).toMatchObject({ ok: false });
  });
});

describe("parseAssignmentCreateInput", () => {
  it("accepts a class only, a subject only, or both", () => {
    expect(
      parseAssignmentCreateInput({ membershipId: ID, classId: OTHER_ID }).ok,
    ).toBe(true);
    expect(
      parseAssignmentCreateInput({ membershipId: ID, subjectId: OTHER_ID }).ok,
    ).toBe(true);
    expect(
      parseAssignmentCreateInput({
        membershipId: ID,
        classId: OTHER_ID,
        subjectId: OTHER_ID,
      }).ok,
    ).toBe(true);
  });

  it("treats blank id fields as absent", () => {
    const result = parseAssignmentCreateInput({
      membershipId: ID,
      classId: "",
      subjectId: OTHER_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.classId).toBeNull();
    expect(result.value.subjectId).toBe(OTHER_ID);
  });

  it("refuses an assignment with neither a class nor a subject", () => {
    expect(
      parseAssignmentCreateInput({
        membershipId: ID,
        classId: "",
        subjectId: "",
      }).ok,
    ).toBe(false);
  });

  it("rejects a malformed class id and a missing membership", () => {
    expect(
      parseAssignmentCreateInput({ membershipId: ID, classId: "nope" }).ok,
    ).toBe(false);
    expect(parseAssignmentCreateInput({ classId: OTHER_ID }).ok).toBe(false);
  });
});

describe("parseAssignmentDeleteInput", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(parseAssignmentDeleteInput({ assignmentId: ID }).ok).toBe(true);
    expect(parseAssignmentDeleteInput({ assignmentId: "  " }).ok).toBe(false);
    expect(parseAssignmentDeleteInput(null).ok).toBe(false);
  });
});
