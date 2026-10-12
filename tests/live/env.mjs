// Live-verification helper: loads .env.local without printing secrets.
// Committed intentionally (contains no credentials, only variable names).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

export function loadEnvLocal() {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

export function requiredClientConfig() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !publishable || !secret) {
    throw new Error(
      ".env.local is missing one of the required Supabase variables",
    );
  }
  return { url, publishable, secret };
}
