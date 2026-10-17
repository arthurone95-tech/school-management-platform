import type { NextResponse } from "next/server";

import { parseSubjectUpdateInput } from "@/lib/administration/requests";
import { updateSubject } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Renames a subject, changes its code, or activates/deactivates it (D-029)
 * behind `subject.manage`. Scoped to the caller's school.
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

  const access = await resolveSchoolAccess(supabase, "subject.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseSubjectUpdateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateSubject({
    supabase,
    schoolId: access.schoolId,
    subjectId: parsed.value.subjectId,
    ...(parsed.value.name !== undefined ? { name: parsed.value.name } : {}),
    ...(parsed.value.code !== undefined ? { code: parsed.value.code } : {}),
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

  return json({ ok: true, subject: result.subject });
}
