import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase Auth confirmation callback (D-024).
 *
 * The staff invitation email links here with a single-use token_hash. The
 * route exchanges the token with Supabase Auth, which confirms the invited
 * email and establishes a session, then redirects the user to the password
 * step (/join). Invalid or expired tokens fall back to the landing page with
 * an error marker rather than leaking what failed.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      if (type === "invite") {
        // Invited user: choose a password, then sign in to activate.
        return NextResponse.redirect(new URL("/join", request.url));
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/?auth=error", request.url));
}
