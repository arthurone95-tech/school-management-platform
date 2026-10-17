import type { NextResponse } from "next/server";

import { parseSchoolProfileUpdateInput } from "@/lib/administration/requests";
import { updateSchoolProfile } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Updates the school name (D-029) behind `school.manage`.
 *
 * The code is the tenant reference used at student sign-in (D-020) and is
 * deliberately not editable here. The write runs on the caller's session client,
 * so the `schools_update_managers` policy is the boundary.
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

  const access = await resolveSchoolAccess(supabase, "school.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseSchoolProfileUpdateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateSchoolProfile({
    supabase,
    schoolId: access.schoolId,
    name: parsed.value.name,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, school: result.school });
}
