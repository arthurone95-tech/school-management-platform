// Live check 10: the staff dashboard surfaces (D-024/D-025 Phase 2 slice).
//
// Covers: the sign-in page rendering; the dashboard redirecting an anonymous
// visitor to sign-in and rendering for a signed-in administrator; and
// GET /api/staff/invitations — which the dashboard list is built on — for
// identity, school scoping, the `member.manage` permission, cross-school
// denial, and the derived pending / accepted / revoked statuses.
//
// No email is involved: the shareable activation link is returned in the
// response body, so the whole chain stays inside the app.
import {
  appGetJson,
  appGetRaw,
  appPostJson,
  appBaseUrl,
  createCookieJar,
  createReporter,
  loadState,
  waitForApp,
} from "./lib.mjs";

const state = loadState();
const report = createReporter("staff dashboard");

function randomEmail(prefix) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@exampleschool.example`;
}

function randomPassword() {
  return `Lb!${crypto.randomUUID().replaceAll("-", "")}`;
}

/** Extracts the single-use credential from a shareable link's fragment. */
function tokenFromLink(link) {
  return new URL(link).hash.replace(/^#token=/, "");
}

/** Signs in through the app and returns a cookie jar holding the session. */
async function signIn(email, password) {
  const res = await appPostJson("/api/staff/sign-in", { email, password });
  if (res.status !== 200 || res.payload?.ok !== true) {
    throw new Error(`sign-in failed for ${email} (status=${res.status})`);
  }
  const jar = createCookieJar();
  jar.applySetCookie(res.setCookie);
  return jar;
}

/** Issues a staff invitation from the caller's own school. */
async function invite(jar, email, role) {
  const res = await appPostJson(
    "/api/staff/invite",
    { email, role },
    jar.header(),
  );
  if (res.status !== 201 || res.payload?.ok !== true) {
    throw new Error(`invite failed for ${email} (status=${res.status})`);
  }
  return res.payload;
}

/** Accepts a shareable link in a fresh, session-less browser context. */
async function acceptLink(link, password) {
  return appPostJson("/api/staff/invitations/accept", {
    token: tokenFromLink(link),
    password,
  });
}

async function main() {
  if (!(await waitForApp())) {
    throw new Error(`app not reachable at ${appBaseUrl()}`);
  }

  const adminA = state.admins?.A;
  const adminB = state.admins?.B;
  if (!adminA || !adminB) {
    throw new Error(
      "state has no seeded administrators; run 02-seed.mjs first",
    );
  }

  // --- the dashboard surfaces -------------------------------------------
  const signInPage = await appGetRaw("/sign-in");
  report.check(
    signInPage.status === 200 && signInPage.body.includes("Staff sign-in"),
    "/sign-in renders for an anonymous visitor",
    `status=${signInPage.status}`,
  );

  // Under Partial Prerender the static shell is served with 200 and the
  // session read streams in; the redirect arrives in that stream (as a
  // NEXT_REDIRECT payload plus a meta-refresh fallback), not as an HTTP 3xx.
  const anonymousDashboard = await appGetRaw("/dashboard");
  report.check(
    anonymousDashboard.status === 200 &&
      anonymousDashboard.body.includes("/sign-in") &&
      anonymousDashboard.body.includes('http-equiv="refresh"'),
    "/dashboard streams a redirect to /sign-in for an anonymous visitor",
    `status=${anonymousDashboard.status}`,
  );

  const listAnon = await appGetJson("/api/staff/invitations");
  report.check(
    listAnon.status === 401,
    "GET /api/staff/invitations without a session is rejected (401)",
    `status=${listAnon.status}`,
  );

  // --- an administrator of the school ------------------------------------
  const sessionA = await signIn(adminA.email, adminA.password);

  const mineA = await appGetJson("/api/staff/me", sessionA.header());
  report.check(
    mineA.status === 200 && mineA.payload?.schoolId === state.schools?.A,
    "the seeded administrator still resolves to school A",
    `status=${mineA.status} school=${mineA.payload?.schoolId}`,
  );

  const signedInDashboard = await appGetRaw("/dashboard", sessionA.header());
  report.check(
    signedInDashboard.status === 200 &&
      signedInDashboard.body.includes("Staff invitations"),
    "/dashboard renders for a signed-in administrator",
    `status=${signedInDashboard.status}`,
  );

  const listed = await appGetJson("/api/staff/invitations", sessionA.header());
  report.check(
    listed.status === 200 && Array.isArray(listed.payload?.invitations),
    "an administrator of school A can list its invitations",
    `status=${listed.status} count=${listed.payload?.invitations?.length}`,
  );

  // --- invite, then see it as pending -------------------------------------
  const inviteeEmail = randomEmail("dash.teacher");
  const issued = await invite(sessionA, inviteeEmail, "teacher");
  report.check(
    typeof issued.activationLink === "string" &&
      issued.activationLink.includes("/join#token="),
    "issuing an invitation returns a shareable activation link",
    "status=201",
  );

  const afterInvite = await appGetJson(
    "/api/staff/invitations",
    sessionA.header(),
  );
  const invited = afterInvite.payload?.invitations?.find(
    (row) => row.email === inviteeEmail,
  );
  report.check(
    invited?.status === "pending" && invited?.role === "teacher",
    "the new invitation appears as pending with the invited role",
    `status=${invited?.status} role=${invited?.role}`,
  );

  // --- cross-school isolation ---------------------------------------------
  const sessionB = await signIn(adminB.email, adminB.password);
  const listedB = await appGetJson("/api/staff/invitations", sessionB.header());
  const leaked = listedB.payload?.invitations?.some(
    (row) => row.email === inviteeEmail,
  );
  report.check(
    listedB.status === 200 && leaked === false,
    "an administrator of school B never sees school A's invitation",
    `status=${listedB.status} leaked=${leaked}`,
  );

  const revokeByB = await appPostJson(
    "/api/staff/invitations/revoke",
    { invitationId: invited?.invitationId },
    sessionB.header(),
  );
  report.check(
    revokeByB.status !== 200,
    "school B cannot revoke school A's invitation",
    `status=${revokeByB.status}`,
  );

  // --- a teacher without member.manage is refused -------------------------
  const inviteePassword = randomPassword();
  const accepted = await acceptLink(issued.activationLink, inviteePassword);
  report.check(
    accepted.status === 200,
    "the invited teacher accepts the shareable link",
    `status=${accepted.status}`,
  );

  const teacherSession = await signIn(inviteeEmail, inviteePassword);
  const teacherList = await appGetJson(
    "/api/staff/invitations",
    teacherSession.header(),
  );
  report.check(
    teacherList.status === 403,
    "a teacher without member.manage cannot list invitations (403)",
    `status=${teacherList.status}`,
  );

  const acceptedList = await appGetJson(
    "/api/staff/invitations",
    sessionA.header(),
  );
  const acceptedRow = acceptedList.payload?.invitations?.find(
    (row) => row.email === inviteeEmail,
  );
  report.check(
    acceptedRow?.status === "accepted",
    "the accepted invitation is reported as accepted",
    `status=${acceptedRow?.status}`,
  );

  // --- revoking a genuinely pending invitation ----------------------------
  const pendingEmail = randomEmail("dash.pending");
  const pendingIssued = await invite(sessionA, pendingEmail, "teacher");
  const revoked = await appPostJson(
    "/api/staff/invitations/revoke",
    { invitationId: pendingIssued.invitationId },
    sessionA.header(),
  );
  report.check(
    revoked.payload?.ok === true,
    "an administrator revokes a pending invitation",
    `status=${revoked.status}`,
  );

  const revokedList = await appGetJson(
    "/api/staff/invitations",
    sessionA.header(),
  );
  const revokedRow = revokedList.payload?.invitations?.find(
    (row) => row.email === pendingEmail,
  );
  report.check(
    revokedRow?.status === "revoked",
    "the revoked invitation is reported as revoked",
    `status=${revokedRow?.status}`,
  );

  const revokedLink = await acceptLink(
    pendingIssued.activationLink,
    randomPassword(),
  );
  report.check(
    revokedLink.status !== 200,
    "a revoked activation link no longer works",
    `status=${revokedLink.status}`,
  );

  if (!report.summary()) {
    process.exit(1);
  }
}

await main();
