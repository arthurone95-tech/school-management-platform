/**
 * Supabase public configuration.
 *
 * Only values that are safe to ship to the browser are read here. The
 * server-only secret key is read in `admin.ts`, which is never imported by
 * client code.
 *
 * Values are read lazily, inside functions, so that importing this module does
 * not require a configured project. This keeps the local scaffold buildable
 * before a Supabase project exists (`docs/PHASE0_RISK_REGISTER.md` 10.1).
 */

export interface SupabasePublicConfig {
  readonly url: string;
  readonly publishableKey: string;
}

function readConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

/**
 * Returns the public configuration, or `null` when it is not configured.
 * Callers that must run in a configured environment should use
 * {@link requireSupabasePublicConfig}.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  return readConfig();
}

/**
 * Returns the public configuration or throws a clear, non-sensitive error.
 * Does not include any credential value in the message.
 */
export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = readConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (see .env.example).",
    );
  }
  return config;
}
