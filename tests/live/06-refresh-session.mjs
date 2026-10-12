// Live check 06: the session-refresh path is invoked and refreshes a real token
// (risk register R-01 / test plan 7.2).
//
// The control wording requires observing a token refresh, not inferring it from
// the absence of an error. We shorten the project's access-token lifetime via
// the Supabase Management API, sign in through the app, let the access token
// expire, then make one request through the Next.js proxy and assert that the
// access token was actually rotated (new `exp`, new value). The original
// lifetime is restored afterwards (also on failure).
//
// Requirements:
//   - The app must be running (LIVE_APP_URL, default http://localhost:3100) and
//     the project seeded and the learner activated (run 02/03 first).
//   - SUPABASE_MGMT_TOKEN and SUPABASE_MGMT_PROJECT_REF must be set in the
//     environment (a scoped Management API token; never committed).
//   - Standalone: node tests/live/06-refresh-session.mjs
import { adminClient, appBaseUrl, loadState, createReporter } from "./lib.mjs";
import { mgmtFetch } from "./mgmt.mjs";
import {
  accessTokenExpFromCookieValue,
  cookieMapFromSetCookie,
  cookieHeader,
} from "./session-cookies.mjs";

const base = appBaseUrl();
const state = loadState();

// Give the auth config change time to propagate to the running cluster.
const SETTLE_MS = 5000;

/** Signs in through the app's portal endpoint and returns the session cookies. */
async function portalSignIn() {
  const res = await fetch(`${base}/api/portal/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schoolCode: "ALPHA",
      username: state.learners.A.username,
      password: "ResetPassword123!",
    }),
  });
  if (res.status !== 200) {
    throw new Error(`portal sign-in returned ${res.status}`);
  }
  return cookieMapFromSetCookie(res.headers.getSetCookie?.() ?? []);
}

async function fetchWithCookies(path, cookieMap) {
  const res = await fetch(`${base}${path}`, {
    headers: cookieMap ? { cookie: cookieHeader(cookieMap) } : {},
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, setCookie };
}

const report = createReporter("session refresh");

async function main() {
  const admin = adminClient();
  const learner = await admin
    .from("learners")
    .select("id, portal_access_state")
    .eq("id", state.learners.A.id)
    .maybeSingle();
  if (!learner.data || learner.data.portal_access_state !== "active") {
    throw new Error(
      "learner A is not active; run 02-seed and 03-portal-flow first",
    );
  }

  const original = await mgmtFetch("/config/auth", "GET");
  const originalExpiry = original.jwt_exp;

  await mgmtFetch("/config/auth", "PATCH", { jwt_exp: 60 });
  await new Promise((r) => setTimeout(r, SETTLE_MS));

  try {
    const cookies = await portalSignIn();
    const tokenCookie = Object.values(cookies)[0];
    const expOld = accessTokenExpFromCookieValue(tokenCookie);
    if (!tokenCookie)
      throw new Error("sign-in did not set an auth-token cookie");

    // Wait until the access token is demonstrably expired.
    const now = Math.floor(Date.now() / 1000);
    const waitMs = Math.max(0, (expOld + 8 - now) * 1000);
    await new Promise((r) => setTimeout(r, waitMs + 1000));

    const refresh = await fetchWithCookies("/", cookies);
    const refreshed = cookieMapFromSetCookie(refresh.setCookie);
    const newValue = Object.values(refreshed)[0];

    report.check(
      refresh.status === 200,
      "request with an expired session is served (proxy ran)",
      `status=${refresh.status}`,
    );

    let expNew = null;
    let detail = "no refreshed auth cookie";
    if (newValue) {
      try {
        expNew = accessTokenExpFromCookieValue(newValue);
        detail = `exp ${expOld} -> ${expNew}`;
      } catch {
        detail = "refreshed cookie present but unreadable";
      }
    }
    const rotated =
      refresh.status === 200 &&
      Boolean(newValue) &&
      expNew !== null &&
      expNew > expOld;
    report.check(
      rotated,
      "an actual token refresh is observed (new exp, rotated cookie)",
      detail,
    );
  } finally {
    await mgmtFetch("/config/auth", "PATCH", { jwt_exp: originalExpiry });
    await new Promise((r) => setTimeout(r, SETTLE_MS));
  }

  const restored = await mgmtFetch("/config/auth", "GET");
  report.check(
    restored.jwt_exp === originalExpiry,
    "jwt_exp restored to its original value",
    `${restored.jwt_exp}`,
  );

  process.exitCode = report.summary() ? 0 : 1;
}

main().catch((error) => {
  console.error("refresh test error:", error.message ?? error);
  process.exit(1);
});
