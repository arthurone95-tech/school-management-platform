/**
 * Proficiency remarks and ranking helpers for the GES standard framework.
 */

export type Proficiency =
  | "High Proficiency"
  | "Proficient"
  | "Approaching Proficient"
  | "Emerging";

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