"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicConfig } from "./env";

/**
 * Browser Supabase client.
 *
 * Uses the publishable key only. Every read and write it performs is still
 * subject to Row Level Security; the browser is untrusted
 * (`docs/SYSTEM_ARCHITECTURE.md` 4.1). `createBrowserClient` already keeps a
 * single instance internally.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();
  return createBrowserClient(url, publishableKey);
}
