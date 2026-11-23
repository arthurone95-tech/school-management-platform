/**
 * Read-only shapes for the administrator school overview.
 *
 * Kept separate from the server loader so both the gate and the dashboard UI
 * can import the types without pulling server-only code into the client bundle.
 * Every figure is derived from the caller's own school on a permission-gated
 * session; the UI never chooses a school.
 */

export interface OverviewClassCount {
  readonly classId: string;
  readonly className: string;
  readonly count: number;
}

export interface OverviewEvent {
  readonly id: string;
  readonly title: string;
  readonly eventType: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface OverviewExam {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: string;
}

export interface OverviewAssessment {
  readonly id: string;
  readonly name: string;
  readonly className: string;
  readonly assessedOn: string;
}

export interface DashboardOverview {
  readonly maleLearners: number;
  readonly femaleLearners: number;
  readonly otherLearners: number;
  readonly activeLearners: number;
  readonly inactiveLearners: number;
  readonly enrolmentByClass: readonly OverviewClassCount[];
  readonly upcomingEvents: readonly OverviewEvent[];
  readonly upcomingExams: readonly OverviewExam[];
  readonly upcomingAssessments: readonly OverviewAssessment[];
  readonly incomplete: boolean;
}
