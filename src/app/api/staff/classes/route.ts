import type { NextResponse } from "next/server";

import { listActiveClasses } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lists the caller's school classes for the enrolment form's class selector.
 *
 * The school is resolved from the caller's own active membership — never from
 * the request — and the caller must hold `class.read`. The read runs on the
 * caller's session, so Row Level Security scopes it to that school regardless
 * of this handler (D-018).
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "class.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const classes = await listActiveClasses(supabase, access.schoolId);
  if (classes === null) {
    return json({ ok: false, error: "The classes could not be loaded." }, 500);
  }

  return json({ ok: true, classes });
}
