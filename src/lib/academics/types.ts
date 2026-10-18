/**
 * Shared view types and pure grading arithmetic for the assessment slice
 * (docs/DECISIONS.md D-031).
 *
 * Isomorphic (no database imports) so the server operations, the browser client
 * and the unit tests all speak the same shapes and compute grades the same way.
 *
 * `docs/PRD.md` 11 records that grading differs between schools and is
 * unvalidated, so nothing here assumes a scale. A school configures its own
 * bands (`GradeBandSummary`); with no bands, a score has a percentage and no
 * grade, which is the honest answer rather than a default threshold.
 */

/** A percentage expressed as a whole number 0-100 for display and comparison. */
export type Percentage = number;

export interface GradeBandSummary {
  readonly id: string;
  readonly minPercentage: number;
  readonly label: string;
  readonly remark: string | null;
  readonly isPassing: boolean;
}

export interface AssessmentSummary {
  readonly id: string;
  readonly classId: string;
  readonly className: string;
  readonly subjectId: string | null;
  readonly subjectName: string | null;
  readonly termId: string | null;
  readonly name: string;
  readonly maxScore: number;
  readonly assessedOn: string;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly markedCount: number;
  readonly learnerCount: number;
}

export interface ResultEntry {
  readonly learnerId: string;
  readonly registrationNumber: string;
  readonly fullName: string;
  /** Null while unmarked. */
  readonly score: number | null;
  readonly percentage: Percentage | null;
  readonly grade: GradeBandSummary | null;
  readonly remark: string | null;
}

export interface ResultSheet {
  readonly assessment: AssessmentSummary;
  readonly entries: readonly ResultEntry[];
  /** False when the caller may read the sheet but not change the marks. */
  readonly isEditable: boolean;
}

export interface ClassAssessmentRow {
  readonly assessmentId: string;
  readonly name: string;
  readonly maxScore: number;
  readonly assessedOn: string;
  readonly averagePercentage: Percentage | null;
  readonly highestPercentage: Percentage | null;
  readonly lowestPercentage: Percentage | null;
  readonly passedCount: number;
  readonly markedCount: number;
  readonly learnerCount: number;
}

export interface ClassAcademicReport {
  readonly classId: string;
  readonly className: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly gradingIsConfigured: boolean;
  readonly assessments: readonly ClassAssessmentRow[];
  readonly learners: readonly {
    readonly learnerId: string;
    readonly registrationNumber: string;
    readonly fullName: string;
    readonly averagePercentage: Percentage | null;
    readonly bestGrade: GradeBandSummary | null;
    readonly assessmentsTaken: number;
  }[];
}

/** A percentage of a score against an assessment maximum, to two decimals. */
export function percentageOf(score: number, maxScore: number): Percentage {
  if (maxScore <= 0) {
    return 0;
  }
  return roundPercentage((score / maxScore) * 100);
}

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The band a percentage falls into: the one with the highest `minPercentage` that
 * the percentage still reaches. Returns `null` when the school has configured no
 * band that low, which is a real answer — a school with no scale configured
 * should not be shown an invented one.
 *
 * `bands` may arrive in any order; order does not matter here.
 */
export function resolveGrade(
  bands: readonly GradeBandSummary[],
  percentage: Percentage,
): GradeBandSummary | null {
  let best: GradeBandSummary | null = null;
  for (const band of bands) {
    if (percentage >= band.minPercentage) {
      if (best === null || band.minPercentage > best.minPercentage) {
        best = band;
      }
    }
  }
  return best;
}

/** Whether a percentage passes, given the school's bands. */
export function isPassing(
  bands: readonly GradeBandSummary[],
  percentage: Percentage,
): boolean | null {
  const grade = resolveGrade(bands, percentage);
  return grade === null ? null : grade.isPassing;
}

/**
 * The arithmetic mean of the given percentages, or `null` when there are none.
 *
 * Deliberately unweighted: weighting is a grading rule `docs/PRD.md` 11 records
 * as unvalidated, so this slice averages what was marked and says so, rather
 * than inventing weights.
 */
export function averagePercentage(
  percentages: readonly (Percentage | null)[],
): Percentage | null {
  const marked = percentages.filter(
    (value): value is Percentage => value !== null,
  );
  if (marked.length === 0) {
    return null;
  }
  const total = marked.reduce((sum, value) => sum + value, 0);
  return roundPercentage(total / marked.length);
}
