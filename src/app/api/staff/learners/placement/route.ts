import type { NextResponse } from "next/server";

import { parsePlacementChangeInput } from "@/lib/enrolment/requests";
import { changePlacement } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Changes a student's class (`learner.placement.manage`, D-028).
 *
 * The previous placement is ended and a new one is opened, keeping one current
 * placement per learner (ENROLMENT_PERMISSION_MODEL 5.5). The writes run on the
 * caller's session client, so the `learner_class_placements` insert/update
 * policies and the composite foreign keys keep both the student and the target
 * class inside one school; the partial unique index
 * `placements_one_current_per_learner` prevents two open placements even under
 * a concurrent change. Another school's student or class is a `404` / `400`.
 */

const REASON_STATUS: Record<
  | "learner_not_found"
  | "class_not_found"
  | "learner_inactive"
  | "conflict"
  | "other",
  number
> = {
  learner_not_found: 404,
  class_not_found: 400,
  learner_inactive: 409,
  conflict: 409,
  other: 500,
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(
    supabase,
    "learner.placement.manage",
  );
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parsePlacementChangeInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await changePlacement({
    supabase,
    schoolId: access.schoolId,
    userId: access.userId,
    learnerId: parsed.value.learnerId,
    classId: parsed.value.classId,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({
    ok: true,
    learner: result.learner,
    unchanged: result.unchanged,
  });
}
