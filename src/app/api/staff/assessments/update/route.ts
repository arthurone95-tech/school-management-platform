import type { NextResponse } from "next/server";

import { parseAssessmentUpdateInput } from "@/lib/academics/requests";
import { updateAssessment } from "@/lib/server/academics";
import { utcToday } from "@/lib/dates";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Renames, re-dates or retires an assessment (D-031), behind
 * `assessment.manage` and scoped by `can_access_class`.
 *
 * An assessment is retired by `is_active: false`, following the retire-by-
 * deactivation pattern used for classes and subjects (D-028, D-029). Marks
 * already recorded are never removed.
 *
 * The maximum score can be changed, but not below a mark already recorded: the
 * `check_result_score` trigger rejects the new maximum while any score exceeds
 * it, which surfaces here as a `409` rather than silently invalidating marks.
 */

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  other: 500,
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "assessment.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseAssessmentUpdateInput(body, utcToday());
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateAssessment({
    supabase,
    schoolId: access.schoolId,
    assessmentId: parsed.value.assessmentId,
    name: parsed.value.name,
    maxScore: parsed.value.maxScore,
    assessedOn: parsed.value.assessedOn,
    notes: parsed.value.notes,
    isActive: parsed.value.isActive,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, assessment: result.assessment });
}
