// Shared helpers for the live verification scripts.
//
// These scripts are committed (they contain no credentials); the state file and
// generated passwords live outside the repo, in the approved temp directory.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { requiredClientConfig } from "./env.mjs";

export const STATE_PATH =
  "C:/Users/AI-DEV/AppData/Local/Temp/opencode/live-state.json";

export function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

export function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function adminClient() {
  const { url, secret } = requiredClientConfig();
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonClient() {
  const { url, publishable } = requiredClientConfig();
  return createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function projectUrl() {
  return requiredClientConfig().url;
}

export function appBaseUrl() {
  return process.env.LIVE_APP_URL ?? "http://localhost:3100";
}

export function randomPassword() {
  return `Lb!${crypto.randomUUID().replaceAll("-", "")}`;
}

/** Simple test reporter shared by the live scripts. */
export function createReporter(title) {
  const rows = [];
  return {
    ok(name, detail = "") {
      rows.push({ ok: true, name, detail });
      console.log(`PASS | ${name}${detail ? ` | ${detail}` : ""}`);
    },
    fail(name, detail = "") {
      rows.push({ ok: false, name, detail });
      console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    },
    check(condition, name, detail = "") {
      if (condition) this.ok(name, detail);
      else this.fail(name, detail);
    },
    summary() {
      const passed = rows.filter((r) => r.ok).length;
      console.log(`\n[${title}] ${passed}/${rows.length} checks passed`);
      return rows.every((r) => r.ok);
    },
  };
}
