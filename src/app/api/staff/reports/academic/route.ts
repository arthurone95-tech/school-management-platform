import type { NextResponse } from "next/server";

import { parseAcademicReportQuery } from "@/lib/academics/requests";
import { buildClassAcademicReport } from "@/lib/server/academics";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The class academic report (D-031): a class's assessments and its per-learner
 * summary, which is the "academic summaries and reports" area of Phase 4.
 *
 * Behind `report.read`, granted to `school_administrator` only. A teacher holds
 * class-scoped `assessment.read` and sees the assessments they teach, but the
 * whole-class summary is the administrator's view, for the same reason
 * `attendance.report` is.
 *
 * Averages are unweighted arithmetic means of the marked percentages, and
 * `gradingIsConfigured` is false when the school has no bands, so the interface
 * can say that plainly rather than showing a blank grade column. No universal
 * grading rule is applied (`docs/PRD.md` 11).
 */

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "report.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const parsed = parseAcademicReportQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const report = await buildClassAcademicReport({
    supabase,
    schoolId: access.schoolId,
    classId: parsed.value.classId,
    from: parsed.value.from,
    to: parsed.value.to,
  });

  if (report === null) {
    return json({ ok: false, error: "The report could not be built." }, 404);
  }

  return json({ ok: true, report });
}
