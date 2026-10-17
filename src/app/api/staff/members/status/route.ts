import type { NextResponse } from "next/server";

import { parseMemberStatusInput } from "@/lib/administration/requests";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { setMemberStatus } from "@/lib/server/staff-members";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Suspends, restores or revokes a staff membership (D-029) behind
 * `member.manage`.
 *
 * Following the approved learner pattern (D-023) a membership is never deleted:
 * `revoked` is a terminal state that removes access, and `suspended` can be
 * restored. `has_school_permission` ignores a non-active membership, so the
 * change takes effect immediately, and the database trigger records an audit
 * event. The write runs on the caller's session client behind
 * `school_members_update_managers`.
 */

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "member.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseMemberStatusInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await setMemberStatus({
    supabase,
    schoolId: access.schoolId,
    membershipId: parsed.value.membershipId,
    action: parsed.value.action,
  });

  if (!result.ok) {
    return json({ ok: false, error: result.message }, 404);
  }

  return json({ ok: true, status: result.status });
}
