/**
 * Shared view types for GES 50 + 50 score entry and terminal reports.
 *
 * Isomorphic and free of database imports, like the custom result types in
 * `types.ts`. The browser and the server both speak these shapes, and the
 * calculation fields are derived with `src/lib/school/ges-calculator.ts`.
 */

import type { GesGrade, GesRubric, Proficiency } from "@/lib/school/ges-calculator";
export type { GesRubric };

export interface GesClassOption {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface GesTermOption {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly academicYearId: string;
  readonly academicYearName: string;
  readonly isCurrent: boolean;
}

export interface GesSubjectScore {
  readonly subjectName: string;
  /** Null until the first result for this subject has been saved. */
  readonly assessmentId: string | null;
  readonly classScore: number | null;
  readonly examScore: number | null;
  readonly totalScore: number | null;
  readonly grade: GesGrade | null;
  readonly proficiency: Proficiency | null;
  /** Qualitative ratings for early-years classes; empty for numeric subjects. */
  readonly rubrics: readonly GesRubric[];
  /** Competition rank across the class, highest total first. */
  readonly position: number | null;
}

export interface GesLearnerResult {
  readonly learnerId: string;
  readonly registrationNumber: string;
  readonly fullName: string;
  readonly subjects: readonly GesSubjectScore[];
  /** Sum of the marked subject totals, or null when nothing is marked. */
  readonly totalScore: number | null;
  /** Mean of the marked subject totals, or null when nothing is marked. */
  readonly averageScore: number | null;
  readonly markedSubjects: number;
  readonly isComplete: boolean;
  /** Competition rank by totalScore across the class. */
  readonly position: number | null;
}

export interface GesSheet {
  readonly classId: string;
  readonly className: string;
  readonly termId: string;
  readonly termName: string;
  readonly academicYearName: string;
  readonly nextTermBegins: string | null;
  /** Early-years classes use developmental rubrics, not 50 + 50 marks. */
  readonly earlyYears: boolean;
  readonly subjects: readonly string[];
  readonly learners: readonly GesLearnerResult[];
  readonly isEditable: boolean;
}

export interface GesOptionsResponse {
  readonly classes: readonly GesClassOption[];
  readonly terms: readonly GesTermOption[];
  readonly sheet: GesSheet | null;
}
