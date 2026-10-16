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

/**
 * HTTP helpers for the live scripts that drive the app itself, including the
 * session cookie handling. `09-staff-auth.mjs` predates them and keeps its own
 * local copies so the already-verified suite is left untouched.
 */

export function createCookieJar() {
  const store = new Map();
  return {
    header: () =>
      [...store.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    applySetCookie(rawList) {
      for (const raw of rawList ?? []) {
        const [pair] = raw.split(";");
        const eq = pair?.indexOf("=") ?? -1;
        if (eq === -1) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (value) store.set(name, value);
        else store.delete(name);
      }
    },
  };
}

export async function appGetJson(path, cookie) {
  const res = await fetch(`${appBaseUrl()}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const payload = await res.json().catch(() => null);
  return { status: res.status, payload };
}

export async function appPostJson(path, body, cookie) {
  const res = await fetch(`${appBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  return {
    status: res.status,
    payload,
    setCookie: res.headers.getSetCookie?.() ?? [],
  };
}

export async function appGetRaw(path, cookie) {
  const res = await fetch(`${appBaseUrl()}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const body = await res.text().catch(() => "");
  return {
    status: res.status,
    location: res.headers.get("location"),
    body,
  };
}

export async function waitForApp(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${appBaseUrl()}/`, { redirect: "manual" });
      if (res.status) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}
