/**
 * Shared shapes for the enrolment feature.
 *
 * Kept free of `server-only` imports so the client components can import the
 * types without pulling in a database module (`src/lib/server/enrolment.ts`).
 */

export interface ClassSummary {
  readonly id: string;
  readonly name: string;
}

export interface LearnerSummary {
  readonly id: string;
  readonly username: string;
  readonly registrationNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly gender: string;
  readonly dateOfBirth: string;
  readonly status: string;
  readonly classId: string | null;
  readonly className: string | null;
}

export interface LearnerPage {
  readonly learners: LearnerSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
