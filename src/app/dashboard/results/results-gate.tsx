import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getAssessmentMode } from "@/lib/server/assessment-mode";
import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ResultsShell } from "./results-shell";

/**
 * Session-gated half of the results page (D-031).
 *
 * Same gate as the other dashboard pages: it reads the request cookies, so it
 * renders inside the page's `<Suspense>` boundary. A user-experience gate only —
 * the API routes repeat the identity, school and permission checks, and the
 * `can_access_class` policy is the boundary that actually holds.
 *
 * Three capabilities, shown according to what the gate established:
 *
 *   * `assessment.read` — see a class's assessments.
 *   * `assessment.manage` — set an assessment up and retire it.
 *   * `result.record` — record and correct marks.
 *   * `report.read` — the administrator-only whole-class summary.
 */
export async function ResultsGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [
    canReadAssessments,
    canManageAssessments,
    canRecordResults,
    canReadReport,
  ] = await Promise.all([
    context.hasPermission("assessment.read"),
    context.hasPermission("assessment.manage"),
    context.hasPermission("result.record"),
    context.hasPermission("report.read"),
  ]);

  if (!canReadAssessments && !canReadReport) {
    redirect("/dashboard");
  }

  const assessmentMode = await getAssessmentMode(supabase, context.schoolId);
  if (!assessmentMode) {
    redirect("/dashboard");
  }

  return (
    <ResultsShell
      assessmentMode={assessmentMode}
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canReadAssessments={canReadAssessments}
      canManageAssessments={canManageAssessments}
      canRecordResults={canRecordResults}
      canReadReport={canReadReport}
    />
  );
}
