import { NextResponse, type NextRequest } from "next/server";

import { parseStaffInviteInput } from "@/lib/staff/requests";
import { inviteStaffUser } from "@/lib/server/staff-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Staff invitation (D-018 requires enrolment roles to be invited; D-021 sets
 * the roles; D-024 records the flow).
 *
 * An authorized school administrator invites a staff member by email. The
 * invitation is scoped to the caller's OWN school — no school identifier is
 * accepted from the request, so an invite can never be aimed at another
 * school. The server creates the auth user and sends Supabase's built-in
 * single-use invitation email; the membership row is created with status
 * 'invited' through the caller's authenticated session so Route Level
 * Security re-checks the `member.manage` permission and the audit trigger
 * records the actor. The invited user accepts via the email link, chooses a
 * password (/join), and activates the membership on first sign-in.
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

  const parsed = parseStaffInviteInput(body);
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

  const admin = createSupabaseAdminClient();
  const redirectTo = `${new URL(request.url).origin}/auth/confirm`;
  const invite = await inviteStaffUser(admin, parsed.value.email, redirectTo);

  if (!invite.ok && invite.reason === "user_exists") {
    return json({ ok: false, error: invite.message }, 409);
  }
  if (!invite.ok) {
    return json({ ok: false, error: invite.message }, 500);
  }

  // Insert the membership row through the caller's authenticated session so
  // RLS re-checks the permission and the audit trigger records the actor.
  const { error: insertError } = await supabase.from("school_members").insert({
    school_id: schoolId,
    user_id: invite.userId,
    role: parsed.value.role,
    status: "invited",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return json(
        {
          ok: false,
          error: "That email already has a membership in this school.",
        },
        409,
      );
    }
    return json(
      { ok: false, error: "The invitation could not be recorded." },
      500,
    );
  }

  return json({ ok: true, role: parsed.value.role }, 201);
}
