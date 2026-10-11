import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabasePublicConfig } from "./env";

/**
 * Server Supabase client for Server Components, Server Actions and Route
 * Handlers. Create one per request — it reads the request cookies.
 *
 * Never make an authorization decision from `getSession()`: it reads the cookie
 * without revalidating it (`docs/PHASE0_RISK_REGISTER.md` R-03). Use
 * `auth.getClaims()` to verify identity, or `auth.getUser()` when an
 * authoritative user record is required.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The session is refreshed in
          // the proxy (`src/proxy.ts`), so this is safe to ignore here. The
          // error must never be swallowed silently in a Route Handler or Server
          // Action, where writes are expected to succeed.
        }
      },
    },
  });
}
