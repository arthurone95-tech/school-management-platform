/**
 * GES / NaCCA 50/50 assessment arithmetic.
 *
 * Basic and JHS subjects are marked out of 50 for continuous class work and 50
 * for the terminal examination. The two components aggregate to a total out of
 * 100, which is then interpreted with the GES nine-point scale and its
 * proficiency descriptors.
 *
 * This module is deliberately pure and isomorphic: the server, the teacher's
 * score-entry view and the unit tests all use the same rules, so a total cannot
 * be calculated one way in the browser and another way when it is saved.
 */

export const GES_CLASS_SCORE_MAX = 50;
export const GES_EXAM_SCORE_MAX = 50;
export const GES_TOTAL_MAX = 100;

export type Proficiency =
  | "High Proficiency"
  | "Proficient"
  | "Approaching Proficient"
  | "Emerging";

/** GES nine-point grading scale (A1..F9). */
export type GesGrade =
  | "A1"
  | "B2"
  | "B3"
  | "C4"
  | "C5"
  | "C6"
  | "D7"
  | "E8"
  | "F9";

export interface GesScoreComponents {
  readonly classScore: number | null;
  readonly examScore: number | null;
}

export interface GesCalculatedScore extends GesScoreComponents {
  /** The 50 + 50 aggregate, or null until both components are marked. */
  readonly totalScore: number | null;
  readonly grade: GesGrade | null;
  readonly proficiency: Proficiency | null;
}

export type GesScoreValidation =
  | {
      readonly ok: true;
      readonly classScore: number | null;
      readonly examScore: number | null;
    }
  | { readonly ok: false; readonly message: string };

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The GES nine-point grade for a percentage (or 100-point total). */
export function gesGradeForPercentage(percentage: number): GesGrade {
  if (percentage >= 80) return "A1";
  if (percentage >= 75) return "B2";
  if (percentage >= 70) return "B3";
  if (percentage >= 65) return "C4";
  if (percentage >= 60) return "C5";
  if (percentage >= 55) return "C6";
  if (percentage >= 50) return "D7";
  if (percentage >= 45) return "E8";
  return "F9";
}

/** The GES proficiency descriptor for a percentage (or 100-point total). */
export function proficiencyForPercentage(percentage: number): Proficiency {
  if (percentage >= 80) return "High Proficiency";
  if (percentage >= 70) return "Proficient";
  if (percentage >= 50) return "Approaching Proficient";
  return "Emerging";
}

/**
 * Validates one 50-mark component. `null` and `undefined` mean "not marked yet";
 * an empty string from a form field is normalised to null by the caller.
 */
export function readGesComponent(
  value: unknown,
  label: "class score" | "exam score",
): { readonly ok: true; readonly value: number | null } | {
  readonly ok: false;
  readonly message: string;
} {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, message: `Enter a valid ${label}.` };
  }
  const max = label === "class score" ? GES_CLASS_SCORE_MAX : GES_EXAM_SCORE_MAX;
  if (value < 0 || value > max) {
    return {
      ok: false,
      message: `The ${label} must be between 0 and ${max}.`,
    };
  }
  return { ok: true, value: roundScore(value) };
}

/** Validates the two 50-mark components together. */
export function validateGesScores(
  classScore: unknown,
  examScore: unknown,
): GesScoreValidation {
  const classResult = readGesComponent(classScore, "class score");
  if (!classResult.ok) {
    return classResult;
  }
  const examResult = readGesComponent(examScore, "exam score");
  if (!examResult.ok) {
    return examResult;
  }
  return {
    ok: true,
    classScore: classResult.value,
    examScore: examResult.value,
  };
}

/**
 * The 50 + 50 total. Returns null until both components are present: a learner
 * with only a class score has not completed the terminal assessment, and
 * showing a total made of one component would overstate the result.
 */
export function calculateGesTotal(
  classScore: number | null | undefined,
  examScore: number | null | undefined,
): number | null {
  if (
    typeof classScore !== "number" ||
    typeof examScore !== "number" ||
    !Number.isFinite(classScore) ||
    !Number.isFinite(examScore)
  ) {
    return null;
  }
  return roundScore(classScore + examScore);
}

/**
 * The complete derived view of one subject result: components, total, grade and
 * proficiency. A partial result keeps its entered component but reports no
 * total, grade or proficiency.
 */
export function calculateGesResult(
  classScore: number | null | undefined,
  examScore: number | null | undefined,
): GesCalculatedScore {
  const total = calculateGesTotal(classScore, examScore);
  return {
    classScore: typeof classScore === "number" ? roundScore(classScore) : null,
    examScore: typeof examScore === "number" ? roundScore(examScore) : null,
    totalScore: total,
    grade: total === null ? null : gesGradeForPercentage(total),
    proficiency: total === null ? null : proficiencyForPercentage(total),
  };
}

/** Ordinal suffix for a position (1st, 2nd, 3rd, 4th, ...). */
export function ordinalSuffix(n: number): string {
  const num = Math.trunc(n);
  const suffixes = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return `${num}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

/** Formats a rank for display, using an en dash for an unranked result. */
export function formatGesPosition(position: number | null | undefined): string {
  return position === null || position === undefined ? "–" : ordinalSuffix(position);
}

/**
 * Competition ranking over marked scores, highest first.
 *
 * Ties share a position and the next distinct score skips the tied places, so
 * `[100, 90, 90, 80]` ranks `1, 2, 2, 4`. Unmarked (null) results are omitted,
 * because a learner with no mark has no position rather than last place.
 */
export function rankScores(
  scores: ReadonlyArray<{ readonly id: string; readonly score: number | null }>,
): Map<string, number> {
  const marked = scores
    .filter(
      (entry): entry is { readonly id: string; readonly score: number } =>
        entry.score !== null && Number.isFinite(entry.score),
    )
    .sort((a, b) => b.score - a.score);

  const ranks = new Map<string, number>();
  let previousScore: number | null = null;
  let position = 0;

  marked.forEach((entry, index) => {
    if (previousScore === null || entry.score !== previousScore) {
      position = index + 1;
      previousScore = entry.score;
    }
    ranks.set(entry.id, position);
  });

  return ranks;
}
