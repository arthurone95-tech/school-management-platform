import type { NextResponse } from "next/server";

import { json } from "@/lib/server/http";
import { listStaffInvitations } from "@/lib/server/staff-invitations";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lists the caller's school staff invitations (D-025).
 *
 * Read-only and administrator-only. The school is resolved from the caller's
 * own active membership — never from the request — and the caller must hold
 * `member.manage` (`resolveSchoolAccess`). The invitation table is server-only,
 * so the read uses the secret key, but it is explicitly scoped to that resolved
 * school, so a caller can never see another school's invitations. Timestamps are
 * returned raw and the status is derived for display; the client never sees a
 * credential.
 */

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "member.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const admin = createSupabaseAdminClient();
  const invitations = await listStaffInvitations(admin, access.schoolId);

  if (invitations === null) {
    return json(
      { ok: false, error: "The invitations could not be loaded." },
      500,
    );
  }

  return json({ ok: true, invitations });
}
