import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicConfig, requireSupabasePublicConfig } from "./env";

describe("Supabase public configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when the project is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("returns the configured URL and publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_example",
    );

    expect(getSupabasePublicConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("throws when configuration is required but absent, without naming secrets", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => requireSupabasePublicConfig()).toThrow(/not configured/i);
  });
});
