import { NextResponse, type NextRequest } from "next/server";

import { rateLimitKey, signInLimiter } from "@/lib/portal/rate-limit";
import {
  parseStaffSignInInput,
  STAFF_SIGN_IN_FAILURE_MESSAGE,
} from "@/lib/staff/requests";
import { classifySignIn } from "@/lib/staff/membership";
import {
  activateMembership,
  findMembershipsForUser,
} from "@/lib/server/staff-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Staff sign-in: email + password (D-021, D-024).
 *
 * Staff authenticate with an email address directly against Supabase Auth. On
 * success the server resolves the caller's school membership and role; the
 * school is never taken from the request. An invited membership is activated
 * on the first confirmed sign-in (the invite email's confirmation link must
 * have been followed first, otherwise Supabase refuses the password sign-in).
 *
 * Failures are uniform so the endpoint cannot be used to discover which staff
 * accounts exist, and the path is rate-limited like the student portal.
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
    return json({ ok: false, error: STAFF_SIGN_IN_FAILURE_MESSAGE }, 400);
  }

  const parsed = parseStaffSignInInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const { email, password } = parsed.value;

  const decision = signInLimiter.check(
    rateLimitKey("staff-sign-in", clientAddress(request), email),
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

  const supabase = await createSupabaseServerClient();
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    return json({ ok: false, error: STAFF_SIGN_IN_FAILURE_MESSAGE }, 401);
  }

  const admin = createSupabaseAdminClient();
  const memberships = await findMembershipsForUser(admin, signInData.user.id);
  if (!memberships.ok) {
    return json({ ok: false, error: "Sign-in could not be completed." }, 500);
  }

  const outcome = classifySignIn(memberships.rows);

  switch (outcome.kind) {
    case "active":
      return json({ ok: true, role: outcome.membership.role }, 200);
    case "invited": {
      const activated = await activateMembership(
        admin,
        outcome.membership,
        signInData.user.id,
      );
      if (!activated) {
        return json(
          { ok: false, error: "Sign-in could not be completed." },
          500,
        );
      }
      return json({ ok: true, role: outcome.membership.role }, 200);
    }
    case "not-staff":
      return json(
        { ok: false, error: "This account is not a school staff member." },
        403,
      );
    case "denied":
      return json(
        { ok: false, error: "This account's school access is not active." },
        403,
      );
  }
}
