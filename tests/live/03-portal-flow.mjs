// Live check 03: the student portal flow over real HTTP against the running app.
//
// Covers: administrator issuance (authorized, unauthorized, cross-school),
// one-time activation, single-use replay, administrator-assisted reset, expiry,
// and school-code + username + password sign-in.
import { createServerClient } from "@supabase/ssr";

import { requiredClientConfig } from "./env.mjs";
import { adminClient, appBaseUrl, loadState, createReporter } from "./lib.mjs";

const { url, publishable } = requiredClientConfig();
const base = appBaseUrl();
const state = loadState();
const admin = adminClient();
const report = createReporter("portal flow");

function createCookieJar() {
  const store = new Map();
  return {
    getAll: () =>
      [...store.entries()].map(([name, value]) => ({ name, value })),
    setAll: (list) => {
      for (const { name, value } of list) store.set(name, value);
    },
    header: () =>
      [...store.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
  };
}

async function adminSession(email, password) {
  const jar = createCookieJar();
  const client = createServerClient(url, publishable, { cookies: jar });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(`admin sign-in failed: ${error.message}`);
  return { cookie: jar.header(), userId: data.user.id };
}

async function postJson(path, body, cookie) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON */
  }
  return {
    status: res.status,
    payload,
    setCookie: res.headers.getSetCookie?.() ?? [],
  };
}

async function waitForServer(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${base}/`, { redirect: "manual" });
      if (res.status) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const learnerA = state.learners.A;
const learnerB = state.learners.B;

async function main() {
  if (!(await waitForServer())) {
    throw new Error(`app not reachable at ${base}`);
  }

  const sessionA = await adminSession(
    state.admins.A.email,
    state.admins.A.password,
  );
  const sessionB = await adminSession(
    state.admins.B.email,
    state.admins.B.password,
  );

  // --- issuance authorization ---
  const unauth = await postJson(
    "/api/admin/portal-credentials",
    { learnerId: learnerA.id, purpose: "activation" },
    null,
  );
  report.check(
    unauth.status === 401,
    "issuance without a session is rejected (401)",
    `got ${unauth.status}`,
  );

  const crossSchool = await postJson(
    "/api/admin/portal-credentials",
    { learnerId: learnerB.id, purpose: "activation" },
    sessionA.cookie,
  );
  report.check(
    crossSchool.status === 403,
    "school A admin cannot issue for school B learner (403)",
    `got ${crossSchool.status}`,
  );

  const badPurpose = await postJson(
    "/api/admin/portal-credentials",
    { learnerId: learnerA.id, purpose: "nonsense" },
    sessionA.cookie,
  );
  report.check(
    badPurpose.status === 400,
    "invalid purpose is rejected (400)",
    `got ${badPurpose.status}`,
  );

  // --- activation ---
  const issued = await postJson(
    "/api/admin/portal-credentials",
    { learnerId: learnerA.id, purpose: "activation" },
    sessionA.cookie,
  );
  report.check(
    issued.status === 201 && typeof issued.payload?.code === "string",
    "school A admin issues an activation code (201)",
    `got ${issued.status}`,
  );
  const activationCode = issued.payload?.code;

  const wrongCode = await postJson(
    "/api/portal/activate",
    {
      code: "ACDE-FGHJ-KMNP-QRTV",
      newPassword: learnerA.password,
      confirmPassword: learnerA.password,
    },
    null,
  );
  report.check(
    wrongCode.status === 400,
    "unknown activation code is rejected (400)",
    `got ${wrongCode.status}`,
  );

  const mismatch = await postJson(
    "/api/portal/activate",
    {
      code: activationCode,
      newPassword: learnerA.password,
      confirmPassword: `${learnerA.password}x`,
    },
    null,
  );
  report.check(
    mismatch.status === 400,
    "mismatched passwords are rejected (400)",
    `got ${mismatch.status}`,
  );

  const activated = await postJson(
    "/api/portal/activate",
    {
      code: activationCode,
      newPassword: learnerA.password,
      confirmPassword: learnerA.password,
    },
    null,
  );
  report.check(
    activated.status === 200 && activated.payload?.ok === true,
    "activation succeeds with a valid code (200)",
    `got ${activated.status} ${JSON.stringify(activated.payload)}`,
  );

  const replay = await postJson(
    "/api/portal/activate",
    {
      code: activationCode,
      newPassword: learnerA.password,
      confirmPassword: learnerA.password,
    },
    null,
  );
  report.check(
    replay.status === 400,
    "activation code cannot be reused (single use)",
    `got ${replay.status}`,
  );

  // --- sign in (school code + username + password) ---
  const signIn = await postJson(
    "/api/portal/sign-in",
    {
      schoolCode: "ALPHA",
      username: learnerA.username,
      password: learnerA.password,
    },
    null,
  );
  report.check(
    signIn.status === 200 && signIn.payload?.ok === true,
    "student signs in with school code + username + password",
    `got ${signIn.status} ${JSON.stringify(signIn.payload)}`,
  );
  report.check(
    signIn.setCookie.some((c) => /^sb-.*-auth-token/.test(c)),
    "sign-in sets a Supabase session cookie",
    `${signIn.setCookie.length} cookie(s)`,
  );

  const wrongPassword = await postJson(
    "/api/portal/sign-in",
    {
      schoolCode: "ALPHA",
      username: learnerA.username,
      password: "wrong-password-123",
    },
    null,
  );
  report.check(
    wrongPassword.status === 401,
    "wrong password is rejected (401)",
    `got ${wrongPassword.status}`,
  );

  const wrongSchool = await postJson(
    "/api/portal/sign-in",
    {
      schoolCode: "DELTA",
      username: learnerA.username,
      password: learnerA.password,
    },
    null,
  );
  report.check(
    wrongSchool.status === 401,
    "wrong school code is rejected (401)",
    `got ${wrongSchool.status}`,
  );

  const unknownUser = await postJson(
    "/api/portal/sign-in",
    {
      schoolCode: "ALPHA",
      username: "no.such.user",
      password: learnerA.password,
    },
    null,
  );
  report.check(
    unknownUser.status === 401,
    "unknown username is rejected (401)",
    `got ${unknownUser.status}`,
  );

  const crossSignIn = await postJson(
    "/api/portal/sign-in",
    {
      schoolCode: "ALPHA",
      username: learnerB.username,
      password: "whatever-123",
    },
    null,
  );
  report.check(
    crossSignIn.status === 401,
    "school A cannot sign in a school B username (401)",
    `got ${crossSignIn.status}`,
  );

  // --- administrator-assisted reset ---
  const reset = await postJson(
    "/api/admin/portal-credentials",
    { learnerId: learnerA.id, purpose: "reset" },
    sessionA.cookie,
  );
  report.check(
    reset.status === 201,
    "school A admin issues a reset code (201)",
    `got ${reset.status}`,
  );

  // Make it expire, then confirm an expired code is refused.
  const expiredCode = reset.payload?.code;
  const expiredCredential = await admin
    .from("learner_portal_credentials")
    .select("id")
    .eq("learner_id", learnerA.id)
    .eq("purpose", "reset")
    .is("used_at", null)
    .maybeSingle();
  if (expiredCredential.data?.id) {
    // Backdate both timestamps: the schema enforces expires_at > issued_at, so
    // moving only expires_at would be rejected and leave the code live.
    const { error: expireError } = await admin
      .from("learner_portal_credentials")
      .update({
        issued_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })
      .eq("id", expiredCredential.data.id);
    report.check(
      !expireError,
      "test setup: credential backdated",
      expireError?.message ?? "ok",
    );
  } else {
    report.fail("test setup: live reset credential found", "no row");
  }
  const expiredAttempt = await postJson(
    "/api/portal/activate",
    {
      code: expiredCode,
      newPassword: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    },
    null,
  );
  report.check(
    expiredAttempt.status === 400,
    "expired code is rejected",
    `got ${expiredAttempt.status}`,
  );

  // A fresh reset works and changes the password.
  const reset2 = await postJson(
    "/api/admin/portal-credentials",
    { learnerId: learnerA.id, purpose: "reset" },
    sessionA.cookie,
  );
  const newPassword = "ResetPassword123!";
  const resetDone = await postJson(
    "/api/portal/activate",
    { code: reset2.payload?.code, newPassword, confirmPassword: newPassword },
    null,
  );
  report.check(
    resetDone.status === 200,
    "administrator-assisted reset changes the password",
    `got ${resetDone.status}`,
  );

  const signInNew = await postJson(
    "/api/portal/sign-in",
    { schoolCode: "ALPHA", username: learnerA.username, password: newPassword },
    null,
  );
  report.check(
    signInNew.status === 200,
    "sign-in works with the reset password",
    `got ${signInNew.status}`,
  );

  const signInOld = await postJson(
    "/api/portal/sign-in",
    {
      schoolCode: "ALPHA",
      username: learnerA.username,
      password: learnerA.password,
    },
    null,
  );
  report.check(
    signInOld.status === 401,
    "the previous password no longer works",
    `got ${signInOld.status}`,
  );

  // --- school B, independent ---
  const issueB = await postJson(
    "/api/admin/portal-credentials",
    { learnerId: learnerB.id, purpose: "activation" },
    sessionB.cookie,
  );
  const activateB = await postJson(
    "/api/portal/activate",
    {
      code: issueB.payload?.code,
      newPassword: learnerB.password,
      confirmPassword: learnerB.password,
    },
    null,
  );
  const signInB = await postJson(
    "/api/portal/sign-in",
    {
      schoolCode: "DELTA",
      username: learnerB.username,
      password: learnerB.password,
    },
    null,
  );
  report.check(
    issueB.status === 201 && activateB.status === 200 && signInB.status === 200,
    "school B learner activates and signs in independently",
    `${issueB.status}/${activateB.status}/${signInB.status}`,
  );

  // Password that was reset for A must not work for B.
  const crossPassword = await postJson(
    "/api/portal/sign-in",
    { schoolCode: "DELTA", username: learnerB.username, password: newPassword },
    null,
  );
  report.check(
    crossPassword.status === 401,
    "school A password is not valid for school B",
    `got ${crossPassword.status}`,
  );

  process.exitCode = report.summary() ? 0 : 1;
}

main().catch((error) => {
  console.error("flow test error:", error.message ?? error);
  process.exit(1);
});
