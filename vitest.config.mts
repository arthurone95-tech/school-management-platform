import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * Unit tests live next to the code they exercise (`*.test.ts`). The default
 * `node` environment is used; a DOM environment will be added when UI
 * components are tested.
 *
 * Unit tests do not prove database or RLS behaviour. Those guarantees require
 * integration tests against a non-production Supabase project
 * (`docs/ROADMAP_AND_TESTING.md` 4.2 and 5).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    // The database suite boots a WASM PostgreSQL instance and applies the
    // migration, which is slower than a unit test to start.
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
