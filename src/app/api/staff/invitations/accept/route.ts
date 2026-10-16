import { NextResponse, type NextRequest } from "next/server";

import { invitationLimiter, rateLimitKey } from "@/lib/portal/rate-limit";
import {
  INVITATION_INVALID_MESSAGE,
  parseStaffInvitationAcceptInput,
} from "@/lib/staff/requests";
import { acceptStaffInvitation } from "@/lib/server/staff-invitations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Accepts a shareable staff invitation link (D-025).
 *
 * No session is required: possession of the single-use, expiring link is the
 * credential. The invitation is claimed atomically before the password is
 * applied, so a link can never be replayed even under concurrent requests. The
 * school, recipient and role all come from the stored invitation, never from
 * the request, so acceptance cannot be redirected to another school or role.
 *
 * Failures are uniform for unusable links (malformed, unknown, expired, revoked
 * or already used).
 */

function clientAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: INVITATION_INVALID_MESSAGE }, 400);
  }

  const parsed = parseStaffInvitationAcceptInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const decision = invitationLimiter.check(
    rateLimitKey(
      "invitation-accept",
      clientAddress(request),
      parsed.value.token,
    ),
  );
  if (!decision.allowed) {
    return json(
      {
        ok: false,
        error: "Too many attempts. Please wait a moment and try again.",
      },
      429,
    );
  }

  const result = await acceptStaffInvitation(createSupabaseAdminClient(), {
    token: parsed.value.token,
    newPassword: parsed.value.password,
  });

  if (!result.ok) {
    if (result.reason === "password") {
      return json(
        {
          ok: false,
          error:
            "We could not set your password because it was rejected. Try a longer, less common password.",
        },
        400,
      );
    }
    if (result.reason === "activation") {
      return json({ ok: false, error: INVITATION_INVALID_MESSAGE }, 500);
    }
    return json({ ok: false, error: INVITATION_INVALID_MESSAGE }, 404);
  }

  return json(
    {
      ok: true,
      message:
        "Your account is ready. Sign in with your email address and new password.",
    },
    200,
  );
}
