// Live check 09: the staff authentication and shareable-invitation foundation.
//
// Covers: staff sign-in and identity (email + password, D-021/D-024); invited
// membership activation on first confirmed sign-in (fallback path); invitation
// authorization and school scoping (never accepts a school id from the request);
// and the D-025 shareable-link flow — issue (no email), preview, single-use
// acceptance, revocation, replacement and cross-school denial.
//
// No mailbox and no email send are involved: the invitation response carries the
// activation link directly, and the single-use credential lives in the URL
// fragment, so the whole app-side chain is exercised here.
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

async function getRaw(path, cookie) {
  const res = await fetch(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const body = await res.text().catch(() => "");
  return {
    status: res.status,
    location: res.headers.get("location"),
    setCookie: res.headers.getSetCookie?.() ?? [],
    body,
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

/** Extracts the 256-bit token from a shareable activation link's fragment. */
function tokenFromLink(link) {
  const hash = new URL(link).hash;
  return hash.replace(/^#token=/, "");
}

/** Creates a confirmed auth user (mirrors an already-accepted account). */
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
  const track = (user) => {
    if (user) createdUsers.push(user);
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

    // --- invited membership activates on the first confirmed sign-in (fallback)
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
    track(invitee);

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
    const invitedEmail = randomEmail("invite.teacher");
    const invite = await postJson(
      "/api/staff/invite",
      { email: invitedEmail, role: "teacher", schoolId: state.schools.B },
      adminJar.header(),
    );
    report.check(
      invite.status === 201 &&
        invite.payload?.ok === true &&
        typeof invite.payload?.activationLink === "string",
      "a school administrator may invite a teacher and receives a shareable link (201)",
      `got ${invite.status}`,
    );

    const invitedUser = await findUserByEmail(invitedEmail);
    report.check(
      invitedUser !== null && !invitedUser.email_confirmed_at,
      "the invited user exists and is unconfirmed (no email was sent)",
      invitedUser
        ? `confirmed=${invitedUser.email_confirmed_at ?? "no"}`
        : "not found",
    );
    track(invitedUser);

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

    // --- shareable link: preview, single-use acceptance ---------------------
    const inviteToken = tokenFromLink(invite.payload.activationLink);
    report.check(
      /^[0-9a-f]{64}$/.test(inviteToken),
      "the invitation response carries a 256-bit token in the link's fragment",
      `link=${String(invite.payload.activationLink).split("#")[0]}#token=…`,
    );

    const previewMalformed = await postJson(
      "/api/staff/invitations/preview",
      { token: "not-a-token" },
      null,
    );
    report.check(
      previewMalformed.status === 400,
      "preview rejects a malformed token (400)",
      `got ${previewMalformed.status}`,
    );

    const previewUnknown = await postJson(
      "/api/staff/invitations/preview",
      { token: "a".repeat(64) },
      null,
    );
    report.check(
      previewUnknown.status === 404,
      "preview rejects an unknown token uniformly (404)",
      `got ${previewUnknown.status}`,
    );

    const preview = await postJson(
      "/api/staff/invitations/preview",
      { token: inviteToken },
      null,
    );
    report.check(
      preview.status === 200 &&
        preview.payload?.ok === true &&
        preview.payload?.email === invitedEmail &&
        preview.payload?.role === "teacher" &&
        typeof preview.payload?.schoolName === "string",
      "preview describes the invitation (recipient, role, school)",
      `status=${preview.status} role=${preview.payload?.role} school=${preview.payload?.schoolName}`,
    );

    const acceptShort = await postJson(
      "/api/staff/invitations/accept",
      { token: inviteToken, password: "short" },
      null,
    );
    report.check(
      acceptShort.status === 400,
      "accept rejects a password below the minimum length (400)",
      `got ${acceptShort.status}`,
    );

    const accept = await postJson(
      "/api/staff/invitations/accept",
      { token: inviteToken, password: "ChosenPassword123!" },
      null,
    );
    report.check(
      accept.status === 200 && accept.payload?.ok === true,
      "accepting the link sets the password and activates the account",
      `got ${accept.status}`,
    );

    const acceptReplay = await postJson(
      "/api/staff/invitations/accept",
      { token: inviteToken, password: "ChosenPassword123!" },
      null,
    );
    report.check(
      acceptReplay.status === 404,
      "the link is single-use: a replay is refused (404)",
      `got ${acceptReplay.status}`,
    );

    const previewAfterAccept = await postJson(
      "/api/staff/invitations/preview",
      { token: inviteToken },
      null,
    );
    report.check(
      previewAfterAccept.status === 404,
      "a used link no longer resolves (404)",
      `got ${previewAfterAccept.status}`,
    );

    const acceptedUser = await findUserByEmail(invitedEmail);
    report.check(
      acceptedUser !== null && Boolean(acceptedUser.email_confirmed_at),
      "accepting the link confirms the email so password sign-in works",
      acceptedUser
        ? `confirmed=${acceptedUser.email_confirmed_at ?? "no"}`
        : "not found",
    );

    if (invitedMembership.data) {
      const memberAfterAccept = await admin
        .from("school_members")
        .select("status")
        .eq("id", invitedMembership.data.id)
        .single();
      report.check(
        memberAfterAccept.data?.status === "active",
        "the membership is active after acceptance",
        `status=${memberAfterAccept.data?.status}`,
      );
    }

    const acceptedAudit = await admin
      .from("audit_events")
      .select("action")
      .eq("target_table", "staff_invitations")
      .eq("action", "staff_invitation_accepted");
    report.check(
      (acceptedAudit.data ?? []).length >= 1,
      "acceptance is recorded in the audit trail",
      `events=${acceptedAudit.data?.length}`,
    );

    const acceptedSignIn = await postJson(
      "/api/staff/sign-in",
      { email: invitedEmail, password: "ChosenPassword123!" },
      null,
    );
    report.check(
      acceptedSignIn.status === 200 &&
        acceptedSignIn.payload?.role === "teacher",
      "the invited person signs in with the password they chose",
      `got ${acceptedSignIn.status} role=${acceptedSignIn.payload?.role}`,
    );

    // --- revocation --------------------------------------------------------
    const revokeEmail = randomEmail("revoke.target");
    const revokeInvite = await postJson(
      "/api/staff/invite",
      { email: revokeEmail, role: "teacher" },
      adminJar.header(),
    );
    report.check(
      revokeInvite.status === 201 && revokeInvite.payload?.ok === true,
      "a second invitation is issued for the revoke scenario (201)",
      `got ${revokeInvite.status}`,
    );
    const revokeToken = tokenFromLink(revokeInvite.payload.activationLink);
    const revokeId = revokeInvite.payload.invitationId;
    track(await findUserByEmail(revokeEmail));

    const revokeAnon = await postJson(
      "/api/staff/invitations/revoke",
      { invitationId: revokeId },
      null,
    );
    report.check(
      revokeAnon.status === 401,
      "revoking without a session is rejected (401)",
      `got ${revokeAnon.status}`,
    );

    const revokeTeacher = await postJson(
      "/api/staff/invitations/revoke",
      { invitationId: revokeId },
      inviteeJar.header(),
    );
    report.check(
      revokeTeacher.status === 403,
      "a teacher cannot revoke (no member.manage permission) (403)",
      `got ${revokeTeacher.status}`,
    );

    const revokeBadId = await postJson(
      "/api/staff/invitations/revoke",
      { invitationId: "not-a-uuid" },
      adminJar.header(),
    );
    report.check(
      revokeBadId.status === 400,
      "revoke rejects a malformed invitation id (400)",
      `got ${revokeBadId.status}`,
    );

    const revoke = await postJson(
      "/api/staff/invitations/revoke",
      { invitationId: revokeId },
      adminJar.header(),
    );
    report.check(
      revoke.status === 200 && revoke.payload?.ok === true,
      "the administrator revokes the live invitation (200)",
      `got ${revoke.status}`,
    );

    const previewRevoked = await postJson(
      "/api/staff/invitations/preview",
      { token: revokeToken },
      null,
    );
    report.check(
      previewRevoked.status === 404,
      "a revoked link no longer resolves (404)",
      `got ${previewRevoked.status}`,
    );

    const acceptRevoked = await postJson(
      "/api/staff/invitations/accept",
      { token: revokeToken, password: "WhateverPassword123!" },
      null,
    );
    report.check(
      acceptRevoked.status === 404,
      "a revoked link cannot be accepted (404)",
      `got ${acceptRevoked.status}`,
    );

    // --- re-invite replaces the previous link and can correct the role ------
    const reInvite = await postJson(
      "/api/staff/invite",
      { email: revokeEmail, role: "school_administrator" },
      adminJar.header(),
    );
    const reToken =
      reInvite.status === 201
        ? tokenFromLink(reInvite.payload.activationLink)
        : "";
    report.check(
      reInvite.status === 201 &&
        reInvite.payload?.role === "school_administrator" &&
        reToken !== revokeToken,
      "re-inviting an unaccepted email issues a fresh link and can correct the role",
      `status=${reInvite.status} role=${reInvite.payload?.role}`,
    );

    const oldPreviewAfterReinvite = await postJson(
      "/api/staff/invitations/preview",
      { token: revokeToken },
      null,
    );
    report.check(
      oldPreviewAfterReinvite.status === 404,
      "the replaced link stays invalid (404)",
      `got ${oldPreviewAfterReinvite.status}`,
    );

    const newPreview = await postJson(
      "/api/staff/invitations/preview",
      { token: reToken },
      null,
    );
    report.check(
      newPreview.status === 200 &&
        newPreview.payload?.role === "school_administrator",
      "the replacement link resolves with the corrected role",
      `status=${newPreview.status} role=${newPreview.payload?.role}`,
    );

    // --- cross-school revocation is denied ---------------------------------
    const adminBJar = createCookieJar();
    const adminBSignIn = await postJson(
      "/api/staff/sign-in",
      { email: state.admins.B.email, password: state.admins.B.password },
      null,
    );
    adminBJar.applySetCookie(adminBSignIn.setCookie);
    const crossRevoke = await postJson(
      "/api/staff/invitations/revoke",
      { invitationId: reInvite.payload.invitationId },
      adminBJar.header(),
    );
    report.check(
      crossRevoke.status === 404,
      "an administrator of another school cannot revoke it (404)",
      `got ${crossRevoke.status}`,
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
    track(revokedUser);

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

    // --- /join serves the acceptance page ----------------------------------
    const joinPage = await getRaw("/join", null);
    report.check(
      joinPage.status === 200 &&
        joinPage.body.includes("Accept your invitation"),
      "/join serves the invitation acceptance page",
      `status=${joinPage.status}`,
    );
  } finally {
    // Remove fixtures. Memberships are removed by user first: school_members ->
    // auth.users is ON DELETE RESTRICT, while staff_invitations cascade from
    // both the membership and the user.
    for (const user of createdUsers) {
      await admin.from("school_members").delete().eq("user_id", user.id);
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
