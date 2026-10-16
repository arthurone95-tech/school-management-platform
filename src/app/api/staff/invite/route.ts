import { NextResponse, type NextRequest } from "next/server";

import { parseStaffInviteInput } from "@/lib/staff/requests";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createPendingStaffUser } from "@/lib/server/staff-accounts";
import {
  findUnacceptedStaffInvitation,
  issueStaffInvitation,
  revokeLiveInvitations,
} from "@/lib/server/staff-invitations";
import { buildStaffInvitationLink } from "@/lib/staff/invitations";

/**
 * Staff invitation (D-018 requires enrolment roles to be invited; D-021 sets
 * the roles; D-024 records the flow).
 *
 * An authorized school administrator invites a staff member by email. The
 * invitation is scoped to the caller's OWN school — no school identifier is
 * accepted from the request, so an invite can never be aimed at another
 * school. The server creates the auth user (no password, unconfirmed email)
 * and a `school_members` row with status 'invited' through the caller's
 * authenticated session, so Route Level Security re-checks the
 * `member.manage` permission and the audit trigger records the actor.
 *
 * No email is sent (D-025): the response carries a shareable activation link
 * that the administrator passes to the recipient out of band. The link holds a
 * single-use, expiring credential in its URL fragment; the recipient accepts
 * it at /join, which sets their password and activates the membership.
 *
 * Re-inviting an email that already has an unaccepted invitation (for example
 * to correct the role) revokes the previous link and issues a new one.
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
  const origin = new URL(request.url).origin;
  const email = parsed.value.email;
  const requestedRole = parsed.value.role;

  const pending = await findUnacceptedStaffInvitation(admin, {
    schoolId,
    email,
  });

  if (pending) {
    const { data: updated, error: updateError } = await supabase
      .from("school_members")
      .update({ role: requestedRole })
      .eq("id", pending.membershipId)
      .eq("school_id", schoolId)
      .eq("status", "invited")
      .select("id")
      .maybeSingle<{ id: string }>();

    if (updateError) {
      return json(
        { ok: false, error: "The invitation could not be updated." },
        500,
      );
    }
    if (!updated) {
      return json(
        {
          ok: false,
          error: "That person already has a membership in this school.",
        },
        409,
      );
    }

    await revokeLiveInvitations(admin, pending.membershipId);
    const issued = await issueStaffInvitation(admin, {
      schoolId,
      membershipId: pending.membershipId,
      userId: pending.userId,
      email,
      role: requestedRole,
      invitedBy: userData.user.id,
    });
    if (!issued) {
      return json(
        { ok: false, error: "The invitation could not be created." },
        500,
      );
    }

    return json(
      {
        ok: true,
        invitationId: issued.invitationId,
        email,
        role: requestedRole,
        expiresAt: issued.expiresAt.toISOString(),
        activationLink: buildStaffInvitationLink(origin, issued.token),
      },
      201,
    );
  }

  const created = await createPendingStaffUser(admin, email);
  if (!created.ok) {
    if (created.reason === "user_exists") {
      return json(
        {
          ok: false,
          error:
            "That email already has an account. Use the existing invitation.",
        },
        409,
      );
    }
    return json(
      { ok: false, error: "The invitation could not be created." },
      500,
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("school_members")
    .insert({
      school_id: schoolId,
      user_id: created.userId,
      role: requestedRole,
      status: "invited",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted) {
    await admin.auth.admin.deleteUser(created.userId).catch(() => undefined);
    if (insertError?.code === "23505") {
      return json(
        {
          ok: false,
          error: "That email already has a membership in this school.",
        },
        409,
      );
    }
    return json(
      { ok: false, error: "The invitation could not be created." },
      500,
    );
  }

  const issued = await issueStaffInvitation(admin, {
    schoolId,
    membershipId: inserted.id,
    userId: created.userId,
    email,
    role: requestedRole,
    invitedBy: userData.user.id,
  });
  if (!issued) {
    await supabase.from("school_members").delete().eq("id", inserted.id);
    await admin.auth.admin.deleteUser(created.userId).catch(() => undefined);
    return json(
      { ok: false, error: "The invitation could not be created." },
      500,
    );
  }

  return json(
    {
      ok: true,
      invitationId: issued.invitationId,
      email,
      role: requestedRole,
      expiresAt: issued.expiresAt.toISOString(),
      activationLink: buildStaffInvitationLink(origin, issued.token),
    },
    201,
  );
}
