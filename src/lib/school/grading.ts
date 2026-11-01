/**
 * Proficiency remarks and ranking helpers for the GES standard framework.
 */

export type Proficiency =
  | "High Proficiency"
  | "Proficient"
  | "Approaching Proficient"
  | "Emerging";

/**
 * GES 9-point grading scale (A1..F9) from a percentage.
 */
export type GesGrade = "A1" | "B2" | "B3" | "C4" | "C5" | "C6" | "D7" | "E8" | "F9";

export function gesGradeForPercentage(percentage: number): GesGrade {
  if (percentage >= 80) return "A1";
  if (percentage >= 75) return "B2";
  if (percentage >= 70) return "B3";
  if (percentage >= 65) return "C4";
  if (percentage >= 60) return "C5";
  if (percentage >= 55) return "C6";
  if (percentage >= 50) return "D7";
  if (percentage >= 40) return "E8";
  return "F9";
}

export function proficiencyForPercentage(percentage: number): Proficiency {
  if (percentage >= 80) return "High Proficiency";
  if (percentage >= 70) return "Proficient";
  if (percentage >= 50) return "Approaching Proficient";
  return "Emerging";
}

/** Ordinal suffix for a position (1st, 2nd, 3rd, 4th, ...). */
export function ordinalSuffix(n: number): string {
  const num = Math.trunc(n);
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Ranks a list of numeric scores descending, returning positions with ties
 * sharing the same rank (competition ranking). Missing/null scores are ranked
 * last.
 */
export function rankScores(
  scores: ReadonlyArray<{ readonly id: string; readonly score: number | null }>,
): Map<string, number> {
  const sorted = [...scores].sort((a, b) => {
    const sa = a.score ?? -Infinity;
    const sb = b.score ?? -Infinity;
    return sb - sa;
  });
  const ranks = new Map<string, number>();
  let position = 0;
  let previous: number | null = null;
  sorted.forEach((entry, index) => {
    const s = entry.score ?? -Infinity;
    if (previous === null || s !== previous) {
      position = index + 1;
      previous = s;
    }
    ranks.set(entry.id, position);
  });
  return ranks;
}