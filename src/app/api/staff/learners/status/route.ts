import type { NextResponse } from "next/server";

import { parseLearnerStatusInput } from "@/lib/enrolment/requests";
import { setLearnerStatus } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Activates or deactivates a learner (`learner.update`, D-028).
 *
 * Deactivation is a state change, never a deletion: the platform holds no
 * delete policy on `learners`, so a leaving student is recorded as `inactive`
 * and their history stays intact (D-023, ENROLMENT_PERMISSION_MODEL 5.2). The
 * `learners` audit trigger records the change. The caller's own school is the
 * only scope, so another school's student is a `404`.
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

  const parsed = parseLearnerStatusInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await setLearnerStatus({
    supabase,
    schoolId: access.schoolId,
    learnerId: parsed.value.learnerId,
    status: parsed.value.status,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, learner: result.learner });
}
