// Live check 09: the staff authentication and invitation foundation.
//
// Covers: staff sign-in and identity (email + password, D-021/D-024), invited
// membership activation on first confirmed sign-in, invitation authorization
// and school scoping (never accepts a school id from the request), revocation
// denial, and the password-set step of invitation acceptance.
//
// The actual invitation-email click (Supabase's built-in single-use link) is a
// browser/manual step and is not exercised here; the email-side of acceptance
// is simulated with email-confirmed server-provisioned users.
import { adminClient, appBaseUrl, loadState, createReporter } from "./lib.mjs";

const base = appBaseUrl();
const state = loadState();
const admin = adminClient();
const report = createReporter("staff auth");

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

async function getJson(path, cookie) {
  const res = await fetch(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const payload = await res.json().catch(() => null);
  return { status: res.status, payload };
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

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

function randomEmail(prefix) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@example.com`;
}

/**
 * Addresses for email-SENDING invitations. Supabase's built-in mailer validates
 * the recipient domain at send time and rejects `@example.com` (no MX/DNS), so
 * a DNS-valid domain is required even when the mailbox does not exist. The
 * local part is random, so the send bounces silently instead of hitting a real
 * mailbox; each full suite run consumes one send from the Free-plan pooler
 * budget (2 per hour, dev-only caveat in docs/PHASE0_RISK_REGISTER.md 10.4).
 */
function randomLiveEmail(prefix) {
  return `${prefix}.${crypto.randomUUID().slice(0, 12)}@gmail.com`;
}

/** Creates a confirmed auth user (mirrors "invitation accepted" state). */
async function createConfirmedUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provisioned_by: "school-platform" },
  });
  if (error || !data.user) throw error ?? new Error("user creation failed");
  return data.user;
}

async function main() {
  if (!(await waitForServer())) {
    throw new Error(`app not reachable at ${base}`);
  }

  const createdUsers = [];
  const createdMemberships = [];
  const track = (user, membershipId) => {
    createdUsers.push(user);
    if (membershipId) createdMemberships.push(membershipId);
  };

  try {
    // --- identity: unauthenticated and wrong-credential failures are uniform
    const missingBody = await postJson("/api/staff/sign-in", {}, null);
    report.check(
      missingBody.status === 400,
      "sign-in without a body is rejected (400)",
      `got ${missingBody.status}`,
    );

    const wrongPassword = await postJson(
      "/api/staff/sign-in",
      { email: state.admins.A.email, password: "DefinitelyWrong123!" },
      null,
    );
    report.check(
      wrongPassword.status === 401,
      "sign-in with a wrong password is uniformly rejected (401)",
      `got ${wrongPassword.status}`,
    );

    // --- staff sign-in + identity
    const adminJar = createCookieJar();
    const adminSignIn = await postJson(
      "/api/staff/sign-in",
      { email: state.admins.A.email, password: state.admins.A.password },
      null,
    );
    adminJar.applySetCookie(adminSignIn.setCookie);
    report.check(
      adminSignIn.status === 200 &&
        adminSignIn.payload?.ok === true &&
        adminSignIn.payload?.role === "school_administrator",
      "school A administrator signs in with email and password",
      `status=${adminSignIn.status} role=${adminSignIn.payload?.role}`,
    );

    const me = await getJson("/api/staff/me", adminJar.header());
    report.check(
      me.status === 200 &&
        me.payload?.role === "school_administrator" &&
        me.payload?.schoolId === state.schools.A,
      "/api/staff/me returns the active school and role",
      `status=${me.status} school=${me.payload?.schoolId}`,
    );

    const meAnon = await getJson("/api/staff/me", null);
    report.check(
      meAnon.status === 401,
      "/api/staff/me without a session is rejected (401)",
      `got ${meAnon.status}`,
    );

    // --- a valid account with no staff membership is denied
    const plainUser = await createConfirmedUser(
      randomEmail("plain"),
      "PlainPassword123!",
    );
    track(plainUser);
    const plainJar = createCookieJar();
    const plainSignIn = await postJson(
      "/api/staff/sign-in",
      { email: plainUser.email, password: "PlainPassword123!" },
      null,
    );
    plainJar.applySetCookie(plainSignIn.setCookie);
    report.check(
      plainSignIn.status === 403 &&
        plainSignIn.payload?.error ===
          "This account is not a school staff member.",
      "an authenticated user without a membership is not staff (403)",
      `got ${plainSignIn.status}`,
    );
    const plainMe = await getJson("/api/staff/me", plainJar.header());
    report.check(
      plainMe.status === 403,
      "/api/staff/me denies a non-staff session (403)",
      `got ${plainMe.status}`,
    );

    // --- invited membership activates on the first confirmed sign-in
    const invitee = await createConfirmedUser(
      randomEmail("activate"),
      "ActivatePassword123!",
    );
    const inviteeMember = await admin
      .from("school_members")
      .insert({
        school_id: state.schools.A,
        user_id: invitee.id,
        role: "teacher",
        status: "invited",
      })
      .select("id")
      .single();
    if (inviteeMember.error) throw inviteeMember.error;
    track(invitee, inviteeMember.data.id);

    const inviteeJar = createCookieJar();
    const inviteeSignIn = await postJson(
      "/api/staff/sign-in",
      { email: invitee.email, password: "ActivatePassword123!" },
      null,
    );
    inviteeJar.applySetCookie(inviteeSignIn.setCookie);
    report.check(
      inviteeSignIn.status === 200 && inviteeSignIn.payload?.role === "teacher",
      "an invited teacher's first sign-in activates the membership",
      `status=${inviteeSignIn.status} role=${inviteeSignIn.payload?.role}`,
    );

    const memberAfter = await admin
      .from("school_members")
      .select("status")
      .eq("id", inviteeMember.data.id)
      .single();
    report.check(
      memberAfter.data?.status === "active",
      "the invited membership is now active",
      `status=${memberAfter.data?.status}`,
    );

    const activationAudit = await admin
      .from("audit_events")
      .select("action, actor_user_id")
      .eq("target_table", "school_members")
      .eq("target_id", inviteeMember.data.id)
      .eq("action", "staff_membership_activated");
    report.check(
      (activationAudit.data ?? []).length === 1 &&
        activationAudit.data?.[0]?.actor_user_id === invitee.id,
      "membership activation is attributed in the audit trail",
      `events=${activationAudit.data?.length}`,
    );

    const inviteeMe = await getJson("/api/staff/me", inviteeJar.header());
    report.check(
      inviteeMe.status === 200 &&
        inviteeMe.payload?.role === "teacher" &&
        inviteeMe.payload?.schoolId === state.schools.A,
      "activated teacher identity resolves to their only school",
      `status=${inviteeMe.status} role=${inviteeMe.payload?.role}`,
    );

    // --- invitation: authorization and school scoping
    const inviteAnon = await postJson(
      "/api/staff/invite",
      { email: randomEmail("anon"), role: "teacher" },
      null,
    );
    report.check(
      inviteAnon.status === 401,
      "invitation without a session is rejected (401)",
      `got ${inviteAnon.status}`,
    );

    const inviteBadRole = await postJson(
      "/api/staff/invite",
      { email: randomEmail("badrole"), role: "platform_owner" },
      adminJar.header(),
    );
    report.check(
      inviteBadRole.status === 400,
      "invitation with a non-staff role is rejected (400)",
      `got ${inviteBadRole.status}`,
    );

    // The client includes another school's id; it must be ignored entirely.
    // This is the suite's single email-SENDING invitation; the address uses a
    // DNS-valid domain because the built-in mailer rejects @example.com.
    const invitedEmail = randomLiveEmail("invite.teacher");
    const invite = await postJson(
      "/api/staff/invite",
      { email: invitedEmail, role: "teacher", schoolId: state.schools.B },
      adminJar.header(),
    );
    report.check(
      invite.status === 201 && invite.payload?.ok === true,
      "a school administrator may invite a teacher into their school (201)",
      `got ${invite.status}`,
    );

    const invitedUser = await findUserByEmail(invitedEmail);
    report.check(
      invitedUser !== null && !invitedUser.email_confirmed_at,
      "the invited user exists and is unconfirmed (email invitation pending)",
      invitedUser
        ? `confirmed=${invitedUser.email_confirmed_at ?? "no"}`
        : "not found",
    );
    if (invitedUser) {
      track(invitedUser);
    }

    const invitedMembership = invitedUser
      ? await admin
          .from("school_members")
          .select("id, school_id, role, status")
          .eq("user_id", invitedUser.id)
          .maybeSingle()
      : { data: null };
    report.check(
      invitedMembership.data?.school_id === state.schools.A &&
        invitedMembership.data?.role === "teacher" &&
        invitedMembership.data?.status === "invited",
      "the invite records a teacher membership in the CALLER'S school only",
      `school=${invitedMembership.data?.school_id} role=${invitedMembership.data?.role}`,
    );

    if (invitedMembership.data) {
      const inviteAudit = await admin
        .from("audit_events")
        .select("action, actor_user_id")
        .eq("target_table", "school_members")
        .eq("target_id", invitedMembership.data.id)
        .eq("action", "insert");
      report.check(
        (inviteAudit.data ?? []).length === 1 &&
          inviteAudit.data?.[0]?.actor_user_id === state.admins.A.userId,
        "the invite is attributed to the acting administrator in the audit trail",
        `events=${inviteAudit.data?.length}`,
      );
    }

    const duplicateInvite = await postJson(
      "/api/staff/invite",
      { email: state.admins.B.email, role: "teacher" },
      adminJar.header(),
    );
    report.check(
      duplicateInvite.status === 409,
      "inviting an email that already has an account is refused (409)",
      `got ${duplicateInvite.status}`,
    );

    const teacherInvite = await postJson(
      "/api/staff/invite",
      { email: randomEmail("by.teacher"), role: "teacher" },
      inviteeJar.header(),
    );
    report.check(
      teacherInvite.status === 403,
      "a teacher cannot invite (no member.manage permission) (403)",
      `got ${teacherInvite.status}`,
    );

    // --- revoked membership denies staff sign-in
    const revokedUser = await createConfirmedUser(
      randomEmail("revoked.staff"),
      "RevokedStaff123!",
    );
    const revokedMember = await admin
      .from("school_members")
      .insert({
        school_id: state.schools.A,
        user_id: revokedUser.id,
        role: "school_administrator",
        status: "revoked",
      })
      .select("id")
      .single();
    if (revokedMember.error) throw revokedMember.error;
    track(revokedUser, revokedMember.data.id);

    const revokedSignIn = await postJson(
      "/api/staff/sign-in",
      { email: revokedUser.email, password: "RevokedStaff123!" },
      null,
    );
    report.check(
      revokedSignIn.status === 403,
      "a revoked staff membership denies sign-in (403)",
      `got ${revokedSignIn.status}`,
    );

    // --- invitation acceptance: password set ends the temporary session
    // The acceptee mirrors an invited staff member (invited membership, email
    // confirmed via the invitation link); password sign-in activates it.
    const acceptee = await createConfirmedUser(
      randomEmail("accept"),
      "OldPassword123!",
    );
    const accepteeMember = await admin
      .from("school_members")
      .insert({
        school_id: state.schools.A,
        user_id: acceptee.id,
        role: "teacher",
        status: "invited",
      })
      .select("id")
      .single();
    if (accepteeMember.error) throw accepteeMember.error;
    track(acceptee, accepteeMember.data.id);
    const acceptJar = createCookieJar();
    const acceptSignIn = await postJson(
      "/api/staff/sign-in",
      { email: acceptee.email, password: "OldPassword123!" },
      null,
    );
    acceptJar.applySetCookie(acceptSignIn.setCookie);
    report.check(
      acceptSignIn.status === 200 && acceptSignIn.payload?.role === "teacher",
      "acceptance fixture's first sign-in activates the invited member",
      `got ${acceptSignIn.status} role=${acceptSignIn.payload?.role}`,
    );

    const setPasswordAnon = await postJson(
      "/api/staff/set-password",
      { password: "NewPassword123!" },
      null,
    );
    report.check(
      setPasswordAnon.status === 401,
      "set-password without a session is rejected (401)",
      `got ${setPasswordAnon.status}`,
    );

    const setPassword = await postJson(
      "/api/staff/set-password",
      { password: "NewPassword123!" },
      acceptJar.header(),
    );
    acceptJar.applySetCookie(setPassword.setCookie);
    report.check(
      setPassword.status === 200 && setPassword.payload?.ok === true,
      "set-password applies the chosen password and ends the session",
      `got ${setPassword.status}`,
    );

    const oldPasswordNow = await postJson(
      "/api/staff/sign-in",
      { email: acceptee.email, password: "OldPassword123!" },
      null,
    );
    report.check(
      oldPasswordNow.status === 401,
      "the old password no longer works (401)",
      `got ${oldPasswordNow.status}`,
    );

    // The new password works and the account IS staff; sign-in succeeds again.
    const newPasswordNow = await postJson(
      "/api/staff/sign-in",
      { email: acceptee.email, password: "NewPassword123!" },
      null,
    );
    report.check(
      newPasswordNow.status === 200 &&
        newPasswordNow.payload?.role === "teacher",
      "the new password works (200) and returns the staff role",
      `got ${newPasswordNow.status} role=${newPasswordNow.payload?.role}`,
    );
  } finally {
    // Remove fixtures (memberships first: FK to auth.users is ON DELETE RESTRICT).
    for (const membershipId of createdMemberships) {
      await admin.from("school_members").delete().eq("id", membershipId);
    }
    for (const user of createdUsers) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }

  if (!report.summary()) process.exit(1);
}

main().catch((error) => {
  console.error("staff auth suite failed:", error.message ?? error);
  process.exit(1);
});
