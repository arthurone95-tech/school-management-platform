// Runs the live verification suite in order against the configured
// non-production Supabase project.
//
// Prerequisites:
//   1. `.env.local` is configured (see .env.example).
//   2. The migration has been applied to the project.
//   3. The app is running: `npm run dev -- -p 3100`
//      (override with LIVE_APP_URL).
//
// Usage: node tests/live/run-all.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const steps = [
  "02-seed.mjs",
  "03-portal-flow.mjs",
  "04-rls-isolation.mjs",
  "05-signup-guard.mjs",
];

for (const step of steps) {
  console.log(`\n===== ${step} =====`);
  const result = spawnSync(process.execPath, [join(here, step)], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n${step} failed (exit ${result.status}). Stopping.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll live checks passed.");
