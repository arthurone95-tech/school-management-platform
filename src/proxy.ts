import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * Next.js Proxy (Next.js 16 renamed `middleware.ts` to `proxy.ts`).
 *
 * The file *must* be named `proxy.ts` on Next.js 16; a `middleware.ts` file is
 * never invoked, which silently stops session refresh and signs users out
 * approximately one hour after login (`docs/PHASE0_RISK_REGISTER.md` R-01).
 *
 * This refreshes the Supabase session cookie. It is not the authorization
 * boundary: each protected page and Server Function must verify identity itself,
 * because a matcher change can silently remove proxy coverage for a route.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every request except Next.js internals, static assets and common
     * metadata files. Assets must not be blocked, or pages render without CSS,
     * JavaScript or images.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt)$).*)",
  ],
};
