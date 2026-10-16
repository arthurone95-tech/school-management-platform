import { NextResponse, type NextRequest } from "next/server";

import { parseStaffInvitationRevokeInput } from "@/lib/staff/requests";
import { revokeStaffInvitation } from "@/lib/server/staff-invitations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Revokes a live staff invitation (D-025).
 *
 * Only an active school administrator whose own active membership is in the
 * invitation's school may revoke it: the school is resolved from the caller's
 * own membership (never from the request) and the revoke is additionally
 * scoped to that school, so a caller can never revoke another school's
 * invitation. The shared link stops working immediately; the pending account
 * and membership remain in a non-functional `invited` state (no password,
 * unconfirmed email) until replaced or removed.
 */

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  // Verify the session with the auth server — never trust a cookie alone.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ ok: false, error: "Not signed in." }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const parsed = parseStaffInvitationRevokeInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  // The caller's own active membership decides the school. RLS only surfaces
  // memberships of schools where the caller is an active member.
  const { data: mine, error: mineError } = await supabase
    .from("school_members")
    .select("school_id, role")
    .eq("user_id", userData.user.id)
    .eq("status", "active");

  if (mineError) {
    return json({ ok: false, error: "Membership could not be resolved." }, 500);
  }

  if (!mine || mine.length === 0) {
    return json(
      { ok: false, error: "You are not an active member of a school." },
      403,
    );
  }
  if (mine.length > 1) {
    // D-017 excludes multi-school membership in the first release; fail closed.
    return json(
      { ok: false, error: "Account membership is misconfigured." },
      500,
    );
  }

  const schoolId = mine[0]?.school_id;
  const { data: allowed, error: permissionError } = await supabase.rpc(
    "has_school_permission",
    {
      target_school_id: schoolId,
      required_permission: "member.manage",
    },
  );

  if (permissionError || allowed !== true) {
    return json({ ok: false, error: "Not permitted." }, 403);
  }

  const revoked = await revokeStaffInvitation(createSupabaseAdminClient(), {
    schoolId,
    invitationId: parsed.value.invitationId,
    actorUserId: userData.user.id,
  });

  if (!revoked) {
    return json({ ok: false, error: "Invitation not found." }, 404);
  }

  return json({ ok: true }, 200);
}
