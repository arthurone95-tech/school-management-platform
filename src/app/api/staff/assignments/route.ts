import type { NextResponse } from "next/server";

import { parseAssignmentCreateInput } from "@/lib/administration/requests";
import { createAssignment } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Assigns a staff member to a class and/or a subject (D-029) behind
 * `assignment.manage`.
 *
 * The composite foreign keys on `public.staff_assignments` require the member,
 * class and subject to belong to the same school, so a cross-school id fails the
 * constraint instead of crossing the tenant boundary. A repeated assignment is
 * rejected by the unique index (409).
 */

const REASON_STATUS: Record<
  "not_found" | "duplicate" | "invalid" | "other",
  number
> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  other: 500,
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "assignment.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseAssignmentCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createAssignment({
    supabase,
    schoolId: access.schoolId,
    membershipId: parsed.value.membershipId,
    classId: parsed.value.classId,
    subjectId: parsed.value.subjectId,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, assignmentId: result.assignmentId }, 201);
}
