import { NextResponse, type NextRequest } from "next/server";

import { parseStaffSetPasswordInput } from "@/lib/staff/requests";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sets a staff member's password during invitation acceptance (D-024).
 *
 * The invited user reaches this page after following the invitation email's
 * single-use link: `/auth/confirm` exchanges the token, which confirms the
 * email and establishes a session, and this route then applies the password.
 * Supabase Auth hashes and stores the password; the platform never sees or
 * stores it. Afterwards the user signs in normally, which activates the
 * membership row.
 */

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  // Only the session-holding user (the invited person) may set their password.
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

  const parsed = parseStaffSetPasswordInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.value.password,
  });

  if (updateError) {
    return json({ ok: false, error: "The password could not be set." }, 400);
  }

  // End the temporary confirmation session; the user signs in with the new
  // password, and that sign-in activates the membership.
  await supabase.auth.signOut();

  return json({ ok: true });
}
