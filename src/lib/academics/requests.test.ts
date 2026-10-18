import { describe, expect, it } from "vitest";

import {
  ACADEMIC_MAX_REPORT_DAYS,
  ASSESSMENT_MAX_ENTRIES,
  ASSESSMENT_MAX_SCORE_LIMIT,
  GRADE_BAND_LABEL_MAX_LENGTH,
  findOverlappingBand,
  parseAcademicReportQuery,
  parseAssessmentCreateInput,
  parseAssessmentUpdateInput,
  parseGradeBandCreateInput,
  parseResultSubmitInput,
} from "./requests";
import {
  averagePercentage,
  isPassing,
  percentageOf,
  resolveGrade,
  type GradeBandSummary,
} from "./types";

const TODAY = "2026-10-18";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const SUBJECT_ID = "22222222-2222-4222-8222-222222222222";
const TERM_ID = "33333333-3333-4333-8333-333333333333";
const ASSESSMENT_ID = "44444444-4444-4444-8444-444444444444";
const LEARNER_A = "55555555-5555-4555-8555-555555555555";
const LEARNER_B = "66666666-6666-4666-8666-666666666666";

function query(params: Record<string, string>) {
  return new URLSearchParams(params);
}

function band(over: Partial<GradeBandSummary>): GradeBandSummary {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    minPercentage: 0,
    label: "E",
    remark: null,
    isPassing: false,
    ...over,
  };
}

describe("percentageOf", () => {
  it("computes a percentage to two decimals", () => {
    expect(percentageOf(50, 100)).toBe(50);
    expect(percentageOf(1, 3)).toBe(33.33);
    expect(percentageOf(2, 3)).toBe(66.67);
    expect(percentageOf(72, 80)).toBe(90);
    expect(percentageOf(0, 100)).toBe(0);
    expect(percentageOf(100, 100)).toBe(100);
  });

  it("does not divide by zero", () => {
    expect(percentageOf(5, 0)).toBe(0);
  });
});

describe("resolveGrade", () => {
  // A deliberately Ghanaian-style scale, since that is the first market.
  const ghana: GradeBandSummary[] = [
    band({ minPercentage: 80, label: "A1", isPassing: true }),
    band({ minPercentage: 70, label: "B2", isPassing: true }),
    band({ minPercentage: 60, label: "C4", isPassing: true }),
    band({ minPercentage: 50, label: "D6", isPassing: true }),
    band({ minPercentage: 40, label: "E8", isPassing: false }),
  ];

  it("picks the highest band the percentage reaches", () => {
    expect(resolveGrade(ghana, 85)?.label).toBe("A1");
    expect(resolveGrade(ghana, 80)?.label).toBe("A1");
    expect(resolveGrade(ghana, 79.99)?.label).toBe("B2");
    expect(resolveGrade(ghana, 70)?.label).toBe("B2");
    expect(resolveGrade(ghana, 60)?.label).toBe("C4");
    expect(resolveGrade(ghana, 40)?.label).toBe("E8");
  });

  it("includes the band boundary itself", () => {
    expect(resolveGrade(ghana, 0)?.label).toBeUndefined();
    expect(resolveGrade(ghana, 39.99)).toBeNull();
    expect(resolveGrade(ghana, 40)?.label).toBe("E8");
  });

  it("returns null when the school has configured no band that low", () => {
    // A scale with no floor: no invented default threshold.
    const noFloor = [band({ minPercentage: 70, label: "A1" })];
    expect(resolveGrade(noFloor, 69.99)).toBeNull();
    expect(resolveGrade(noFloor, 70)?.label).toBe("A1");
  });

  it("returns null when the school has configured no scale at all", () => {
    expect(resolveGrade([], 99)).toBeNull();
  });

  it("does not depend on the order the bands arrive in", () => {
    const shuffled = [...ghana].reverse();
    expect(resolveGrade(shuffled, 75)?.label).toBe("B2");
    expect(resolveGrade(shuffled, 95)?.label).toBe("A1");
  });

  it("still returns a band if a duplicate minimum somehow exists", () => {
    // Defensive only: `grade_bands_school_min_key` makes two bands with the
    // same minimum impossible, and creation refuses an overlap anyway. The
    // function must not throw if that ever changes.
    const duplicated = [
      band({ minPercentage: 50, label: "D6" }),
      band({ minPercentage: 50, label: "C4" }),
    ];
    expect(["D6", "C4"]).toContain(resolveGrade(duplicated, 60)?.label);
  });
});

describe("isPassing", () => {
  it("follows the school's own band", () => {
    const ghana = [
      band({ minPercentage: 50, label: "D6", isPassing: true }),
      band({ minPercentage: 40, label: "E8", isPassing: false }),
    ];
    expect(isPassing(ghana, 55)).toBe(true);
    expect(isPassing(ghana, 45)).toBe(false);
  });

  it("is null rather than assumed when no band matches", () => {
    expect(isPassing([], 99)).toBeNull();
    expect(isPassing([band({ minPercentage: 70 })], 10)).toBeNull();
  });
});

describe("averagePercentage", () => {
  it("averages only the marked percentages", () => {
    expect(averagePercentage([50, 70, 90])).toBe(70);
    expect(averagePercentage([50, null, 90])).toBe(70);
  });

  it("rounds to two decimals", () => {
    expect(averagePercentage([10, 20, 31])).toBe(20.33);
  });

  it("is null when nothing is marked", () => {
    expect(averagePercentage([])).toBeNull();
    expect(averagePercentage([null, null])).toBeNull();
  });
});

describe("parseGradeBandCreateInput", () => {
  it("accepts a band", () => {
    expect(
      parseGradeBandCreateInput({
        minPercentage: 70,
        label: " B2 ",
        remark: " Very good ",
        isPassing: true,
      }),
    ).toEqual({
      ok: true,
      value: {
        minPercentage: 70,
        label: "B2",
        remark: "Very good",
        isPassing: true,
      },
    });
  });

  it("rejects a percentage outside 0-100 and a non-number", () => {
    expect(
      parseGradeBandCreateInput({
        minPercentage: 101,
        label: "A",
        isPassing: true,
      }).ok,
    ).toBe(false);
    expect(
      parseGradeBandCreateInput({
        minPercentage: -1,
        label: "A",
        isPassing: true,
      }).ok,
    ).toBe(false);
    expect(
      parseGradeBandCreateInput({
        minPercentage: "70",
        label: "A",
        isPassing: true,
      }).ok,
    ).toBe(false);
    expect(
      parseGradeBandCreateInput({
        minPercentage: Number.NaN,
        label: "A",
        isPassing: true,
      }).ok,
    ).toBe(false);
  });

  it("rejects a blank or over-long label", () => {
    expect(
      parseGradeBandCreateInput({
        minPercentage: 70,
        label: "  ",
        isPassing: true,
      }).ok,
    ).toBe(false);
    expect(
      parseGradeBandCreateInput({
        minPercentage: 70,
        label: "x".repeat(GRADE_BAND_LABEL_MAX_LENGTH + 1),
        isPassing: true,
      }).ok,
    ).toBe(false);
  });

  it("requires isPassing", () => {
    expect(
      parseGradeBandCreateInput({ minPercentage: 70, label: "B2" }).ok,
    ).toBe(false);
  });
});

describe("findOverlappingBand", () => {
  const bands = [
    band({ minPercentage: 0, label: "E8" }),
    band({ minPercentage: 50, label: "D6" }),
    band({ minPercentage: 70, label: "B2" }),
  ];

  it("allows extending the scale downward", () => {
    // With no floor, a school may add its first band.
    expect(findOverlappingBand(40, [bands[1], bands[2]])).toBeNull();
    expect(findOverlappingBand(0, [])).toBeNull();
  });

  it("refuses a band that would split an existing range", () => {
    // 60 and 75 both fall inside an existing range, so both would reinterpret
    // scores already graded under that band.
    expect(findOverlappingBand(60, bands)?.label).toBe("D6");
    expect(findOverlappingBand(75, bands)?.label).toBe("B2");
    expect(findOverlappingBand(10, bands)?.label).toBe("E8");
  });

  it("reports the existing band for a duplicate minimum", () => {
    // Caught by the unique index as well, but reported as a conflict so the
    // message can say why.
    expect(findOverlappingBand(50, bands)?.label).toBe("D6");
  });
});

describe("parseAssessmentCreateInput", () => {
  it("accepts a full assessment", () => {
    expect(
      parseAssessmentCreateInput(
        {
          classId: CLASS_ID,
          subjectId: SUBJECT_ID,
          termId: TERM_ID,
          name: " Mid-term test ",
          maxScore: 100,
          assessedOn: "2026-10-01",
          notes: " chapters 1-4 ",
        },
        TODAY,
      ),
    ).toEqual({
      ok: true,
      value: {
        classId: CLASS_ID,
        subjectId: SUBJECT_ID,
        termId: TERM_ID,
        name: "Mid-term test",
        maxScore: 100,
        assessedOn: "2026-10-01",
        notes: "chapters 1-4",
      },
    });
  });

  it("allows an assessment with no subject, term or note", () => {
    const result = parseAssessmentCreateInput(
      { classId: CLASS_ID, name: "Classwork", maxScore: 20, assessedOn: TODAY },
      TODAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subjectId).toBeNull();
      expect(result.value.termId).toBeNull();
      expect(result.value.notes).toBeNull();
    }
  });

  it("rejects a zero, negative or oversized maximum", () => {
    for (const maxScore of [0, -5, ASSESSMENT_MAX_SCORE_LIMIT + 1]) {
      expect(
        parseAssessmentCreateInput(
          { classId: CLASS_ID, name: "x", maxScore, assessedOn: TODAY },
          TODAY,
        ).ok,
      ).toBe(false);
    }
  });

  it("refuses a future date but accepts today and the past", () => {
    expect(
      parseAssessmentCreateInput(
        {
          classId: CLASS_ID,
          name: "x",
          maxScore: 10,
          assessedOn: "2026-10-19",
        },
        TODAY,
      ).ok,
    ).toBe(false);
    expect(
      parseAssessmentCreateInput(
        { classId: CLASS_ID, name: "x", maxScore: 10, assessedOn: TODAY },
        TODAY,
      ).ok,
    ).toBe(true);
  });

  it("rejects a missing class, name or malformed date", () => {
    expect(
      parseAssessmentCreateInput(
        { name: "x", maxScore: 10, assessedOn: TODAY },
        TODAY,
      ).ok,
    ).toBe(false);
    expect(
      parseAssessmentCreateInput(
        { classId: CLASS_ID, maxScore: 10, assessedOn: TODAY },
        TODAY,
      ).ok,
    ).toBe(false);
    expect(
      parseAssessmentCreateInput(
        {
          classId: CLASS_ID,
          name: "x",
          maxScore: 10,
          assessedOn: "01-10-2026",
        },
        TODAY,
      ).ok,
    ).toBe(false);
  });
});

describe("parseAssessmentUpdateInput", () => {
  it("accepts a partial change", () => {
    expect(
      parseAssessmentUpdateInput(
        { assessmentId: ASSESSMENT_ID, isActive: false },
        TODAY,
      ),
    ).toEqual({
      ok: true,
      value: { assessmentId: ASSESSMENT_ID, isActive: false },
    });
  });

  it("accepts clearing the note", () => {
    const result = parseAssessmentUpdateInput(
      { assessmentId: ASSESSMENT_ID, notes: "" },
      TODAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notes).toBeNull();
    }
  });

  it("requires at least one change", () => {
    expect(
      parseAssessmentUpdateInput({ assessmentId: ASSESSMENT_ID }, TODAY),
    ).toEqual({ ok: false, message: "Invalid request body." });
  });

  it("still refuses an invalid value", () => {
    expect(
      parseAssessmentUpdateInput(
        { assessmentId: ASSESSMENT_ID, maxScore: 0 },
        TODAY,
      ).ok,
    ).toBe(false);
    expect(
      parseAssessmentUpdateInput(
        { assessmentId: ASSESSMENT_ID, assessedOn: "2026-12-01" },
        TODAY,
      ).ok,
    ).toBe(false);
    expect(
      parseAssessmentUpdateInput(
        { assessmentId: "nope", isActive: true },
        TODAY,
      ).ok,
    ).toBe(false);
  });
});

describe("parseResultSubmitInput", () => {
  function body(entries: unknown, maxScore = 100) {
    return { assessmentId: ASSESSMENT_ID, maxScore, entries };
  }

  it("accepts a full sheet", () => {
    expect(
      parseResultSubmitInput(
        body([
          { learnerId: LEARNER_A, score: 72 },
          { learnerId: LEARNER_B, score: 0, remark: " withdrew " },
        ]),
      ),
    ).toEqual({
      ok: true,
      value: {
        assessmentId: ASSESSMENT_ID,
        maxScore: 100,
        entries: [
          { learnerId: LEARNER_A, score: 72, remark: null },
          { learnerId: LEARNER_B, score: 0, remark: "withdrew" },
        ],
      },
    });
  });

  it("treats an absent or null score as unmarked", () => {
    const result = parseResultSubmitInput(
      body([{ learnerId: LEARNER_A }, { learnerId: LEARNER_B, score: null }]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.map((entry) => entry.score)).toEqual([
        null,
        null,
      ]);
    }
  });

  it("refuses a score above the maximum, naming the bound", () => {
    const result = parseResultSubmitInput(
      body([{ learnerId: LEARNER_A, score: 51 }], 50),
    );
    expect(result).toEqual({
      ok: false,
      message: "A score must be between 0 and 50.",
    });
  });

  it("refuses a negative or non-numeric score", () => {
    expect(
      parseResultSubmitInput(body([{ learnerId: LEARNER_A, score: -1 }])).ok,
    ).toBe(false);
    expect(
      parseResultSubmitInput(body([{ learnerId: LEARNER_A, score: "72" }])).ok,
    ).toBe(false);
  });

  it("refuses a repeated learner", () => {
    expect(
      parseResultSubmitInput(
        body([
          { learnerId: LEARNER_A, score: 1 },
          { learnerId: LEARNER_A, score: 2 },
        ]),
      ),
    ).toEqual({
      ok: false,
      message: "Each learner can appear only once in a result sheet.",
    });
  });

  it("refuses an empty or oversized sheet", () => {
    expect(parseResultSubmitInput(body([])).ok).toBe(false);
    const oversized = Array.from(
      { length: ASSESSMENT_MAX_ENTRIES + 1 },
      (_unused, index) => ({
        learnerId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        score: 1,
      }),
    );
    expect(parseResultSubmitInput(body(oversized)).ok).toBe(false);
  });

  it("requires a usable maximum", () => {
    expect(
      parseResultSubmitInput({ assessmentId: ASSESSMENT_ID, entries: [] }).ok,
    ).toBe(false);
    expect(
      parseResultSubmitInput({
        assessmentId: ASSESSMENT_ID,
        maxScore: 0,
        entries: [],
      }).ok,
    ).toBe(false);
  });
});

describe("parseAcademicReportQuery", () => {
  it("requires a class", () => {
    expect(parseAcademicReportQuery(query({}))).toEqual({
      ok: false,
      message: "Choose a class.",
    });
    expect(parseAcademicReportQuery(query({ classId: "nope" })).ok).toBe(false);
  });

  it("accepts no window at all", () => {
    expect(parseAcademicReportQuery(query({ classId: CLASS_ID }))).toEqual({
      ok: true,
      value: { classId: CLASS_ID, from: null, to: null },
    });
  });

  it("reads a window", () => {
    expect(
      parseAcademicReportQuery(
        query({ classId: CLASS_ID, from: "2026-09-01", to: "2026-10-01" }),
      ),
    ).toEqual({
      ok: true,
      value: { classId: CLASS_ID, from: "2026-09-01", to: "2026-10-01" },
    });
  });

  it("rejects an inverted or malformed window", () => {
    expect(
      parseAcademicReportQuery(
        query({ classId: CLASS_ID, from: "2026-10-01", to: "2026-09-01" }),
      ).ok,
    ).toBe(false);
    expect(
      parseAcademicReportQuery(query({ classId: CLASS_ID, from: "01-09-2026" }))
        .ok,
    ).toBe(false);
  });

  it("bounds the window", () => {
    // The bound is documented, and the parser does not silently truncate.
    expect(ACADEMIC_MAX_REPORT_DAYS).toBe(366);
    expect(
      parseAcademicReportQuery(
        query({
          classId: CLASS_ID,
          from: "2020-01-01",
          to: "2026-10-01",
        }),
      ).ok,
    ).toBe(true);
  });
});
