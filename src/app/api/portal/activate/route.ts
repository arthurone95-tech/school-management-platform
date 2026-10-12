import { NextResponse, type NextRequest } from "next/server";

import {
  ACTIVATION_FAILURE_MESSAGE,
  parseActivateInput,
} from "@/lib/portal/requests";
import { activationLimiter, rateLimitKey } from "@/lib/portal/rate-limit";
import { applyPortalCredential } from "@/lib/server/portal-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * One-time activation and administrator-assisted recovery (D-019, D-020).
 *
 * The student presents the one-time code their school issued and chooses a
 * password. The credential is claimed atomically (single use) before the
 * password is applied, so a code can never be replayed even under concurrent
 * requests. The administrator never sees or supplies the password.
 *
 * Failures are uniform so a code cannot be probed: an expired, already-used,
 * revoked and unknown code all produce the same response.
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
    return json({ ok: false, error: ACTIVATION_FAILURE_MESSAGE }, 400);
  }

  const parsed = parseActivateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const decision = activationLimiter.check(
    rateLimitKey("activate", clientAddress(request), parsed.value.code),
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

  let result;
  try {
    result = await applyPortalCredential(
      createSupabaseAdminClient(),
      parsed.value,
    );
  } catch {
    return json({ ok: false, error: ACTIVATION_FAILURE_MESSAGE }, 500);
  }

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
    return json({ ok: false, error: ACTIVATION_FAILURE_MESSAGE }, 400);
  }

  return json(
    {
      ok: true,
      purpose: result.purpose,
      message:
        result.purpose === "activation"
          ? "Your account is ready. Sign in with your school code, username and new password."
          : "Your password has been changed. Sign in with your new password.",
    },
    200,
  );
}
