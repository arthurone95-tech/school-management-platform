import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Staff sign-out. Clears the Supabase session cookies through the server
 * client, exactly as for any authenticated session. Signing out does not touch
 * membership rows; access decisions are always made per request by RLS and the
 * server-side checks.
 */

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return json({ ok: true });
}
