import type { NextResponse } from "next/server";

import { parseClassUpdateInput } from "@/lib/enrolment/requests";
import { updateClass } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Renames a class and/or sets its active flag (`class.manage`, D-028).
 *
 * A class is never deleted: the `learner_class_placements` foreign key is
 * `ON DELETE RESTRICT`, so deactivating is the supported way to retire a class
 * while past placements stay interpretable (D-023, ENROLMENT_PERMISSION_MODEL
 * 5.2, 5.3). The update runs on the caller's session client and is scoped to
 * the caller's own school, so a class id from another school is a `404` — the
 * same response as one that does not exist, which cannot be told apart.
 */

const REASON_STATUS: Record<"not_found" | "duplicate" | "other", number> = {
  not_found: 404,
  duplicate: 409,
  other: 500,
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "class.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseClassUpdateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateClass({
    supabase,
    schoolId: access.schoolId,
    classId: parsed.value.classId,
    ...(parsed.value.name !== undefined ? { name: parsed.value.name } : {}),
    ...(parsed.value.isActive !== undefined
      ? { isActive: parsed.value.isActive }
      : {}),
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, klass: result.klass });
}
