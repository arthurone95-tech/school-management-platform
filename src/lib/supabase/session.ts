import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "./env";

/**
 * Refreshes the Supabase auth session for an incoming request.
 *
 * This is the R-01/R-02 control (`docs/PHASE0_RISK_REGISTER.md`): the session
 * is refreshed in exactly one place per navigation — the proxy — so that
 * single-use refresh tokens are not consumed twice by concurrent requests, and
 * the refreshed cookies and cache headers are written to the outgoing response.
 *
 * `auth.getClaims()` verifies the token before the response is committed. It is
 * deliberately not `getSession()`, which reads the cookie without revalidating.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const config = getSupabasePublicConfig();

  if (!config) {
    if (process.env.NODE_ENV === "production") {
      // Fail loudly rather than silently disabling session refresh in
      // production, where a missing configuration would log users out.
      throw new Error(
        "Supabase configuration is required in production (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
      );
    }

    // Local scaffold with no Supabase project configured: there is no session
    // to refresh. This is not a security bypass — protected pages and Server
    // Functions re-verify identity server-side via `getClaims()`.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Pass refreshed cookies to the downstream Server Components...
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        // ...rebuild the response so it carries them to the browser, apply the
        // cookie options, and apply the cache headers that stop a CDN or
        // reverse proxy from caching a response holding another user's session.
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Must run before the response is committed, so a refresh writes its cookies.
  await supabase.auth.getClaims();

  return response;
}
