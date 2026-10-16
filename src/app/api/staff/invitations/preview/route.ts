import { NextResponse, type NextRequest } from "next/server";

import { invitationLimiter, rateLimitKey } from "@/lib/portal/rate-limit";
import {
  INVITATION_INVALID_MESSAGE,
  parseStaffInvitationTokenInput,
} from "@/lib/staff/requests";
import { previewStaffInvitation } from "@/lib/server/staff-invitations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Verifies a shareable staff invitation link (D-025).
 *
 * The credential travels in the URL fragment, so the browser posts it here in
 * the request body; it is never placed in a request line and therefore never in
 * an access log. Verification does NOT consume the invitation: it only tells
 * the acceptance page who the invitation is for, the role, the school and the
 * expiry, so the recipient can confirm before choosing a password.
 *
 * Every unusable token — malformed, unknown, expired, revoked or already used —
 * returns the same body and status, so a link cannot be probed.
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

  const parsed = parseStaffInvitationTokenInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const decision = invitationLimiter.check(
    rateLimitKey(
      "invitation-preview",
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

  const view = await previewStaffInvitation(
    createSupabaseAdminClient(),
    parsed.value.token,
  );
  if (!view) {
    return json({ ok: false, error: INVITATION_INVALID_MESSAGE }, 404);
  }

  return json(
    {
      ok: true,
      email: view.email,
      role: view.role,
      expiresAt: view.expiresAt,
      schoolName: view.schoolName,
    },
    200,
  );
}
