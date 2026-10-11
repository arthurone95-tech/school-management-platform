import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "./env";

/**
 * Privileged Supabase client using the server-only secret key.
 *
 * This client bypasses Row Level Security (`docs/DATABASE_DOCUMENTATION.md`
 * 5.2). It must only be used in trusted server code, and every operation must
 * perform its own explicit authorization check first. It must never be called
 * from a Client Component, bundled into browser code, or logged.
 *
 * Expected uses: creating student portal accounts and applying
 * student-chosen passwords during activation and administrator-assisted
 * recovery (D-019, D-020). It is not used for ordinary school data access.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured. Add it to the server environment " +
        "(see .env.example). It must never be prefixed with NEXT_PUBLIC_.",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
