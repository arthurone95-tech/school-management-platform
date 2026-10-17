import type { NextResponse } from "next/server";

import { getSchoolProfile } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The caller's school profile (D-029).
 *
 * `GET` returns the school's name, code and status behind `school.manage`.
 * Membership itself already lets staff read the school name (`schools_select_members`,
 * migration 0001); this endpoint is the administration view used by the school
 * settings page, so it is gated to managers. The school is resolved from the
 * caller's own active membership and the read runs on the caller's session
 * client, so Row Level Security remains the boundary.
 */

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "school.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const school = await getSchoolProfile(supabase, access.schoolId);
  if (school === null) {
    return json(
      { ok: false, error: "The school profile could not be loaded." },
      500,
    );
  }

  return json({ ok: true, school });
}
