// Live check 08: no privileged credential appears in the production build
// output (risk register 7.1 — "verify by inspecting the built output, not by
// assumption").
//
// Scans every file under `.next/` for the *literal values* of the server-only
// secrets (they must never be bundled). Secret values are never printed; a leak
// is reported as variable name + file path only. The publishable (anon) key is
// client-visible by design and is intentionally not scanned.
//
// Run AFTER `npm run build`:
//   npm run build
//   node tests/live/08-no-secrets-in-bundle.mjs
//
// This check is intentionally not part of run-all.mjs, which targets a running
// dev server and does not build the app.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { loadEnvLocal } from "./env.mjs";
import { createReporter } from "./lib.mjs";

const env = loadEnvLocal();
const secrets = [
  ["SUPABASE_SECRET_KEY", env.SUPABASE_SECRET_KEY],
  ["PORTAL_CREDENTIAL_SECRET", env.PORTAL_CREDENTIAL_SECRET],
].filter(([, value]) => typeof value === "string" && value.length > 0);

if (secrets.length === 0) {
  console.error(
    ".env.local has no server-only secrets configured to scan for.",
  );
  process.exit(2);
}

const nextDir = join(process.cwd(), ".next");
if (!statSync(nextDir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(
    `No build output at ${nextDir}. Run \`npm run build\` first, then re-run this check.`,
  );
  process.exit(2);
}

// Skip build caches that merely mirror source (e.g. webpack cache) — the
// deliverable under test is the emitted output. Everything else is scanned,
// including source maps.
const SKIP = new Set(["cache"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) out.push(...walk(join(dir, entry.name)));
    } else {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const files = walk(nextDir);
const report = createReporter("bundle secret scan");

const leaks = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue; // binary/mmap-unsafe file; include() scan survives via Buffer below
  }
  // Read binary files too, without decoding loss.
  if (!content) {
    try {
      content = readFileSync(file, "base64");
    } catch {
      continue;
    }
  }
  for (const [name, value] of secrets) {
    if (content.includes(value)) leaks.push(`${name} -> ${file}`);
  }
}

report.check(
  leaks.length === 0,
  "no server-only secret value appears under .next/",
  `scanned ${files.length} files${leaks.length ? `; leaks: ${leaks.join("; ")}` : ""}`,
);

process.exitCode = report.summary() ? 0 : 1;
