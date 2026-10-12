import { NextResponse } from "next/server";

import { isStaffRole } from "@/lib/staff/requests";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Current staff identity and school context.
 *
 * Returns the caller's active school membership and role for the school they
 * belong to. The school comes from the signed-in session's membership row,
 * never from the request. Students (portal accounts) and staff without an
 * active membership receive the same denial.
 */

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  // Verify the session with the auth server — never trust a cookie alone.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ ok: false, error: "Not signed in." }, 401);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("school_members")
    .select("school_id, role, status")
    .eq("user_id", userData.user.id)
    .eq("status", "active");

  if (membershipError) {
    return json({ ok: false, error: "Membership could not be resolved." }, 500);
  }

  // RLS only surfaces memberships of schools where the caller is an active
  // member, so an invited or revoked membership is invisible here.
  const active = memberships ?? [];
  if (active.length !== 1 || !isStaffRole(active[0]?.role ?? "")) {
    return json(
      { ok: false, error: "This account is not a school staff member." },
      403,
    );
  }

  const membership = active[0];
  return json({
    ok: true,
    userId: userData.user.id,
    role: membership.role,
    schoolId: membership.school_id,
  });
}
