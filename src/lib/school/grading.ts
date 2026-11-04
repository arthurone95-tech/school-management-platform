/**
 * Backwards-compatible names for the GES grading helpers.
 *
 * The calculation rules live in `ges-calculator.ts`; this module only re-exports
 * them so older imports keep working while there is a single implementation.
 */

export {
  formatGesPosition,
  gesGradeForPercentage,
  ordinalSuffix,
  proficiencyForPercentage,
  rankScores,
} from "./ges-calculator";
export type { GesGrade, Proficiency } from "./ges-calculator";
