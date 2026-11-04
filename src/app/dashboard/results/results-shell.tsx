"use client";

import type { AssessmentMode } from "@/lib/school/assessment-mode";

import { GesResults } from "./ges-results";
import { ResultsClient } from "./results-client";

/**
 * Chooses the results experience for the school's active assessment framework.
 *
 * The two modes are intentionally separate screens. A GES school gets the
 * official 50 + 50 subject sheet and terminal report card; a custom school gets
 * the existing assessment/grade-band workspace. The APIs enforce the same
 * separation, so this is presentation routing rather than the authorization
 * boundary.
 */
export function ResultsShell({
  assessmentMode,
  email,
  role,
  schoolName,
  canReadAssessments,
  canManageAssessments,
  canRecordResults,
  canReadReport,
}: {
  readonly assessmentMode: AssessmentMode;
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canReadAssessments: boolean;
  readonly canManageAssessments: boolean;
  readonly canRecordResults: boolean;
  readonly canReadReport: boolean;
}) {
  if (assessmentMode === "ges_standard") {
    return (
      <GesResults
        schoolName={schoolName}
        canReadAssessments={canReadAssessments}
      />
    );
  }

  return (
    <ResultsClient
      email={email}
      role={role}
      schoolName={schoolName}
      canReadAssessments={canReadAssessments}
      canManageAssessments={canManageAssessments}
      canRecordResults={canRecordResults}
      canReadReport={canReadReport}
    />
  );
}
