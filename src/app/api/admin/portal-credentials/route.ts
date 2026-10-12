import { NextResponse, type NextRequest } from "next/server";

import {
  ensureLearnerPortalAccount,
  issuePortalCredential,
  type CredentialPurpose,
} from "@/lib/server/portal-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Administrator issuance of a one-time activation or reset credential.
 *
 * This is the administrator's side of the student portal flow: they ask the
 * server to issue a code for a learner, show it to the student once, and never
 * learn the password. Authorization is enforced here (not in the UI): the caller
 * must have a verified session *and* the `learner.portal.manage` permission for
 * the learner's own school. The school is taken from the learner row, never from
 * the request, so a caller cannot aim an authorised action at another school.
 */

const PURPOSES: readonly CredentialPurpose[] = ["activation", "reset"];

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

  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const learnerId =
    typeof record.learnerId === "string" ? record.learnerId : null;
  const purpose = record.purpose as CredentialPurpose | undefined;

  if (!learnerId || !purpose || !PURPOSES.includes(purpose)) {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const admin = createSupabaseAdminClient();

  // The learner's school is authoritative; the caller cannot choose it.
  const { data: learner, error: learnerError } = await admin
    .from("learners")
    .select("id, school_id")
    .eq("id", learnerId)
    .maybeSingle<{ id: string; school_id: string }>();

  if (learnerError || !learner) {
    return json({ ok: false, error: "Learner not found." }, 404);
  }

  const { data: allowed, error: permissionError } = await supabase.rpc(
    "has_school_permission",
    {
      target_school_id: learner.school_id,
      required_permission: "learner.portal.manage",
    },
  );

  if (permissionError || allowed !== true) {
    return json({ ok: false, error: "Not permitted." }, 403);
  }

  if (purpose === "activation") {
    const account = await ensureLearnerPortalAccount(admin, learner.id);
    if (!account) {
      return json(
        { ok: false, error: "Could not provision a portal account." },
        500,
      );
    }
  }

  const issued = await issuePortalCredential(admin, {
    learnerId: learner.id,
    purpose,
    issuedBy: userData.user.id,
  });

  if (!issued) {
    return json({ ok: false, error: "Could not issue a credential." }, 400);
  }

  return json(
    {
      ok: true,
      // The raw code is returned exactly once and never stored or logged.
      code: issued.code,
      expiresAt: issued.expiresAt.toISOString(),
      purpose,
    },
    201,
  );
}
