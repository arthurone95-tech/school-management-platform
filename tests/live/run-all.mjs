// Runs the live verification suite in order against the configured
// non-production Supabase project.
//
// Prerequisites:
//   1. `.env.local` is configured (see .env.example).
//   2. The migration has been applied to the project.
//   3. The app is running: `npm run dev -- -p 3100`
//      (override with LIVE_APP_URL).
//
// Steps 06 (session refresh, R-01) and 07 (concurrent refresh, R-02)
// temporarily shorten the project's jwt_expiry via the Management API and are
// only run when SUPABASE_MGMT_TOKEN and SUPABASE_MGMT_PROJECT_REF are set in
// the environment. They restore the original lifetime afterwards.
//
// Step 09 (staff auth) requires migrations 0001-0003 applied to the project
// (0003 aligns the role labels with D-021).
//
// The post-build bundle scan (risk register 7.1) is a separate step because it
// requires a production build and a running dev server is irrelevant to it:
//   npm run build && node tests/live/08-no-secrets-in-bundle.mjs
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
  "09-staff-auth.mjs",
];

if (
  !process.env.SUPABASE_MGMT_TOKEN ||
  !process.env.SUPABASE_MGMT_PROJECT_REF
) {
  console.warn(
    "\nSUPABASE_MGMT_TOKEN / SUPABASE_MGMT_PROJECT_REF not set — skipping\nsession-refresh checks 06 and 07 (they need the Management API to shorten\njwt_expiry temporarily and restore it afterwards).\n",
  );
} else {
  steps.push("06-refresh-session.mjs", "07-concurrent-refresh.mjs");
}

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
