import { NextResponse, type NextRequest } from "next/server";

import {
  parseSignInInput,
  SIGN_IN_FAILURE_MESSAGE,
} from "@/lib/portal/requests";
import { rateLimitKey, signInLimiter } from "@/lib/portal/rate-limit";
import { resolvePortalAccount } from "@/lib/server/portal-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Student sign-in: school code + username + password (D-020).
 *
 * A student supplies no email address. The server resolves (school code,
 * username) to the internal account identifier through the protected mapping,
 * then asks Supabase Auth to verify the password and issue the session. The
 * session cookies are stored exactly as for any Supabase session.
 *
 * The response is uniform on failure so it cannot be used to discover valid
 * school codes or usernames.
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
    return json({ ok: false, error: SIGN_IN_FAILURE_MESSAGE }, 400);
  }

  const parsed = parseSignInInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const { schoolCode, username, password } = parsed.value;

  const decision = signInLimiter.check(
    rateLimitKey(
      "sign-in",
      clientAddress(request),
      `${schoolCode}:${username}`,
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

  let account;
  try {
    account = await resolvePortalAccount(createSupabaseAdminClient(), {
      schoolCode,
      username,
    });
  } catch {
    return json({ ok: false, error: SIGN_IN_FAILURE_MESSAGE }, 500);
  }

  if (!account) {
    return json({ ok: false, error: SIGN_IN_FAILURE_MESSAGE }, 401);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.internalIdentifier,
    password,
  });

  if (error) {
    return json({ ok: false, error: SIGN_IN_FAILURE_MESSAGE }, 401);
  }

  return json({ ok: true, portal: "/portal" }, 200);
}
