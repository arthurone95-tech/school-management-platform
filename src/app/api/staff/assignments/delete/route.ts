import type { NextResponse } from "next/server";

import { parseAssignmentDeleteInput } from "@/lib/administration/requests";
import { deleteAssignment } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Removes a staff assignment (D-029) behind `assignment.manage`.
 *
 * An assignment is a link between existing records, not personal data, so
 * removing it is a delete rather than a state change; the database audit trigger
 * still records it. The operation is scoped to the caller's school.
 */

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

  const parsed = parseAssignmentDeleteInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await deleteAssignment({
    supabase,
    schoolId: access.schoolId,
    assignmentId: parsed.value.assignmentId,
  });

  if (!result.ok) {
    return json({ ok: false, error: result.message }, 404);
  }

  return json({ ok: true });
}
