import type { NextResponse } from "next/server";

import { parseLearnerCorrectionInput } from "@/lib/enrolment/requests";
import { correctLearner } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Corrects a learner record (`learner.update`, D-028).
 *
 * Only the fields present in the body are changed, so the response cannot blank
 * an unrelated column. A correction is audited by the `learners` trigger, which
 * records the changed column names but not their values (D-023,
 * ENROLMENT_PERMISSION_MODEL 5.4). The update runs on the caller's session
 * client and is scoped to the caller's own school, so another school's student
 * is a `404` — indistinguishable from one that does not exist.
 */

const REASON_STATUS: Record<"not_found" | "duplicate" | "other", number> = {
  not_found: 404,
  duplicate: 409,
  other: 500,
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "learner.update");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseLearnerCorrectionInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await correctLearner({
    supabase,
    schoolId: access.schoolId,
    input: parsed.value,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, learner: result.learner });
}
