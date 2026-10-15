// Live check 07: concurrent requests with an expired session do not produce a
// spurious sign-out (risk register R-02 / test plan 7.2).
//
// Supabase refresh tokens are single-use and rotated on refresh. Two
// simultaneous navigations can race for the same refresh token. The control
// requires that this never looks like a sign-out: the winner's rotated cookie
// must keep the session usable afterwards.
//
// Method: shorten jwt_expiry via the Management API, sign in through the app,
// let the access token expire, then fire two requests with the *same* session
// cookie concurrently. Assert both are served, at least one rotated the token,
// and a follow-up request with the rotated cookie still refreshes.
//
// "Still refreshes" accepts either an advanced access-token `exp` or a rotated
// refresh token: `exp` is second-granular, so a follow-up refresh in the same
// second as the winner's rotation ties instead of increasing.
//
// Requirements: app running and seeded (02/03 first), learner A active, and
// SUPABASE_MGMT_TOKEN / SUPABASE_MGMT_PROJECT_REF in the environment.
//
// Standalone: node tests/live/07-concurrent-refresh.mjs
import { adminClient, appBaseUrl, loadState, createReporter } from "./lib.mjs";
import { mgmtFetch } from "./mgmt.mjs";
import {
  accessTokenExpFromCookieValue,
  cookieMapFromSetCookie,
  cookieHeader,
  refreshTokenFromCookieValue,
} from "./session-cookies.mjs";

const base = appBaseUrl();
const state = loadState();
const SETTLE_MS = 5000;

const report = createReporter("concurrent refresh");

function parseExpOrNull(map) {
  const value = Object.values(map)[0];
  if (!value) return null;
  try {
    return accessTokenExpFromCookieValue(value);
  } catch {
    return null;
  }
}

function refreshTokenOrNull(map) {
  const value = Object.values(map)[0];
  if (!value) return null;
  try {
    return refreshTokenFromCookieValue(value);
  } catch {
    return null;
  }
}

/** Picks the refreshed cookie map, preferring the later exp. */
function winnerOf(m1, e1, m2, e2) {
  if (e1 === null && e2 === null) return { map: m1, exp: null };
  if (e2 === null || (e1 !== null && e1 >= e2)) return { map: m1, exp: e1 };
  return { map: m2, exp: e2 };
}

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
  return { status: res.status, setCookie: res.headers.getSetCookie?.() ?? [] };
}

async function waitForExpiry(cookieMap) {
  const exp = parseExpOrNull(cookieMap);
  if (exp === null)
    throw new Error("could not read access token exp before wait");
  const now = Math.floor(Date.now() / 1000);
  const waitMs = Math.max(0, (exp + 8 - now) * 1000);
  await new Promise((r) => setTimeout(r, waitMs + 1000));
}

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
    const c0 = await portalSignIn();
    const exp0 = parseExpOrNull(c0);
    await waitForExpiry(c0);

    // Two simultaneous requests, same expired session cookie (two browser tabs
    // racing after the access token expired).
    const [r1, r2] = await Promise.all([
      fetchWithCookies("/", c0),
      fetchWithCookies("/", c0),
    ]);
    report.check(
      r1.status === 200 && r2.status === 200,
      "both concurrent requests are served (no hard failure)",
      `statuses=${r1.status},${r2.status}`,
    );

    const m1 = cookieMapFromSetCookie(r1.setCookie);
    const m2 = cookieMapFromSetCookie(r2.setCookie);
    const e1 = parseExpOrNull(m1);
    const e2 = parseExpOrNull(m2);
    const refreshedCount = [e1, e2].filter((e) => e !== null).length;
    report.check(
      refreshedCount >= 1,
      "at least one concurrent request rotated the session token",
      `rotated=${refreshedCount}/2`,
    );

    const { map: winnerMap, exp: winnerExp } = winnerOf(m1, e1, m2, e2);
    const winnerRefresh = refreshTokenOrNull(winnerMap);
    const followUp = await fetchWithCookies("/", winnerMap);
    const fMap = cookieMapFromSetCookie(followUp.setCookie);
    const fExp = parseExpOrNull(fMap);
    const fRefresh = refreshTokenOrNull(fMap);
    // A refresh is proven when the follow-up either advanced the access-token
    // `exp` or rotated the refresh token. `exp` is second-granular, so a refresh
    // landing in the same second as the winner's rotation ties rather than
    // increases; the refresh-token rotation is the tie-independent evidence.
    const refreshRotated =
      fRefresh !== null && winnerRefresh !== null && fRefresh !== winnerRefresh;
    const refreshed =
      (fExp !== null && winnerExp !== null && fExp > winnerExp) ||
      refreshRotated;
    report.check(
      followUp.status === 200 &&
        fExp !== null &&
        (winnerExp === null || fExp >= winnerExp) &&
        fExp > exp0 &&
        refreshed,
      "no spurious sign-out: follow-up navigation still refreshes",
      winnerExp === null
        ? "winner had no rotated token; likely reuse-detection revoked the session family"
        : `exp ${winnerExp} -> ${fExp}, refreshRotated=${refreshRotated}`,
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
  console.error("concurrent refresh test error:", error.message ?? error);
  process.exit(1);
});
