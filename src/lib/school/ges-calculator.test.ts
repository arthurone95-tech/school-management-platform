import { describe, expect, it } from "vitest";

import {
  calculateGesResult,
  calculateGesTotal,
  formatGesPosition,
  gesGradeForPercentage,
  ordinalSuffix,
  proficiencyForPercentage,
  rankScores,
  validateGesScores,
} from "./ges-calculator";

describe("ges-calculator", () => {
  it("validates 50-mark components", () => {
    expect(validateGesScores(40, 45)).toEqual({
      ok: true,
      classScore: 40,
      examScore: 45,
    });
    expect(validateGesScores(null, null).ok).toBe(true);
    expect(validateGesScores(50.5, 45).ok).toBe(false);
    expect(validateGesScores(40, -1).ok).toBe(false);
  });

  it("aggregates the two 50-mark components out of 100", () => {
    expect(calculateGesTotal(40, 45)).toBe(85);
    expect(calculateGesTotal(40, null)).toBeNull();
    expect(calculateGesResult(40, 45)).toMatchObject({
      totalScore: 85,
      grade: "A1",
      proficiency: "High Proficiency",
    });
  });

  it("returns no grade or proficiency until both components are marked", () => {
    expect(calculateGesResult(40, null)).toMatchObject({
      classScore: 40,
      examScore: null,
      totalScore: null,
      grade: null,
      proficiency: null,
    });
  });

  it("maps proficiency boundaries", () => {
    expect(proficiencyForPercentage(80)).toBe("High Proficiency");
    expect(proficiencyForPercentage(70)).toBe("Proficient");
    expect(proficiencyForPercentage(50)).toBe("Approaching Proficient");
    expect(proficiencyForPercentage(49)).toBe("Emerging");
  });

  it("maps the nine-point grade scale", () => {
    expect(gesGradeForPercentage(80)).toBe("A1");
    expect(gesGradeForPercentage(75)).toBe("B2");
    expect(gesGradeForPercentage(70)).toBe("B3");
    expect(gesGradeForPercentage(65)).toBe("C4");
    expect(gesGradeForPercentage(60)).toBe("C5");
    expect(gesGradeForPercentage(55)).toBe("C6");
    expect(gesGradeForPercentage(50)).toBe("D7");
    expect(gesGradeForPercentage(45)).toBe("E8");
    expect(gesGradeForPercentage(44)).toBe("F9");
  });

  it("formats ordinal positions", () => {
    expect(ordinalSuffix(1)).toBe("1st");
    expect(ordinalSuffix(2)).toBe("2nd");
    expect(ordinalSuffix(3)).toBe("3rd");
    expect(ordinalSuffix(11)).toBe("11th");
    expect(ordinalSuffix(12)).toBe("12th");
    expect(ordinalSuffix(13)).toBe("13th");
    expect(ordinalSuffix(21)).toBe("21st");
    expect(formatGesPosition(null)).toBe("–");
  });

  it("ranks scores with competition ties", () => {
    const ranks = rankScores([
      { id: "a", score: 90 },
      { id: "b", score: 80 },
      { id: "c", score: 80 },
      { id: "d", score: 70 },
      { id: "e", score: null },
    ]);
    expect(Object.fromEntries(ranks)).toEqual({
      a: 1,
      b: 2,
      c: 2,
      d: 4,
    });
    expect(ranks.has("e")).toBe(false);
  });
});