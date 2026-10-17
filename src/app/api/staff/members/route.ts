import type { NextResponse } from "next/server";

import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { listSchoolMembers } from "@/lib/server/staff-members";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A school's staff members and their assignments (D-029) behind `member.manage`.
 *
 * Membership rows and assignments are read on the caller's session client so Row
 * Level Security scopes them to the caller's school. The server-only secret key
 * is used only to resolve the members' emails from Supabase Auth, and only for
 * the membership ids already read for that school.
 */

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "member.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const admin = createSupabaseAdminClient();
  const members = await listSchoolMembers({
    supabase,
    admin,
    schoolId: access.schoolId,
  });

  if (members === null) {
    return json(
      { ok: false, error: "The staff members could not be loaded." },
      500,
    );
  }

  return json({ ok: true, members });
}
