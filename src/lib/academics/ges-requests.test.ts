import { describe, expect, it } from "vitest";

import { parseGesScoreSubmitInput, parseGesSheetQuery } from "./ges-requests";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TERM_ID = "22222222-2222-4222-8222-222222222222";
const LEARNER_ID = "33333333-3333-4333-8333-333333333333";

describe("ges-requests", () => {
  it("parses the optional sheet query", () => {
    const params = new URLSearchParams({ classId: CLASS_ID, termId: TERM_ID });
    const result = parseGesSheetQuery(params);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.classId).toBe(CLASS_ID);
      expect(result.value.termId).toBe(TERM_ID);
    }
  });

  it("rejects an invalid class id in the sheet query", () => {
    const params = new URLSearchParams({ classId: "not-a-uuid" });
    expect(parseGesSheetQuery(params).ok).toBe(false);
  });

  it("parses a valid learner score submission", () => {
    const result = parseGesScoreSubmitInput({
      classId: CLASS_ID,
      termId: TERM_ID,
      learnerId: LEARNER_ID,
      scores: [
        { subjectName: "Mathematics", classScore: 40, examScore: 45 },
        { subjectName: "English Language", classScore: null, examScore: 30 },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scores).toHaveLength(2);
    }
  });

  it("rejects a score above 50", () => {
    const result = parseGesScoreSubmitInput({
      classId: CLASS_ID,
      termId: TERM_ID,
      learnerId: LEARNER_ID,
      scores: [{ subjectName: "Mathematics", classScore: 51, examScore: 45 }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate subjects", () => {
    const result = parseGesScoreSubmitInput({
      classId: CLASS_ID,
      termId: TERM_ID,
      learnerId: LEARNER_ID,
      scores: [
        { subjectName: "Mathematics", classScore: 40, examScore: 45 },
        { subjectName: "mathematics", classScore: 30, examScore: 35 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty submission", () => {
    const result = parseGesScoreSubmitInput({
      classId: CLASS_ID,
      termId: TERM_ID,
      learnerId: LEARNER_ID,
      scores: [],
    });
    expect(result.ok).toBe(false);
  });
});