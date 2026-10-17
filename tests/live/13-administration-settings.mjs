// Live check 13: Phase 3 school settings and staff administration (D-029).
//
// Covers, through the running app and the real database:
//   * GET  /api/staff/school            — the caller's school profile
//   * POST /api/staff/school/update     — rename the school (code immutable)
//   * GET/POST /api/staff/academic-years          — list / create a year
//   * POST /api/staff/academic-years/update       — rename, dates, make current
//   * POST /api/staff/terms + terms/update        — a year's terms
//   * GET/POST /api/staff/subjects + subjects/update — create, edit, retire
//   * GET  /api/staff/members                     — members and assignments
//   * POST /api/staff/members/status              — suspend / restore / revoke
//   * POST /api/staff/assignments(+delete)        — assign a class/subject
// including school scoping, the new permissions, cross-school denial,
// validation, duplicate handling, the one-current-year rule and the fact that a
// permission-less teacher is refused. It also re-checks that the new pages
// stream a redirect for anonymous visitors.
import {
  adminClient,
  appBaseUrl,
  appGetJson,
  appGetRaw,
  appPostJson,
  createCookieJar,
  createReporter,
  loadState,
  randomPassword,
  waitForApp,
} from "./lib.mjs";

const report = createReporter("administration-settings");

function randomEmail(prefix) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@exampleschool.example`;
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

async function main() {
  const state = loadState();

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

  const admin = adminClient();
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();

  const { data: aClasses } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", state.schools.A);
  const aClassId = aClasses?.[0]?.id;
  const { data: bClasses } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", state.schools.B);
  const bClassId = bClasses?.[0]?.id;
  if (!aClassId || !bClassId) {
    throw new Error("a school has no seeded class");
  }

  // --- pages redirect an anonymous visitor -------------------------------
  for (const path of ["/dashboard/school", "/dashboard/staff"]) {
    const page = await appGetRaw(path);
    report.check(
      page.status === 200 &&
        page.body.includes("/sign-in") &&
        page.body.includes('http-equiv="refresh"'),
      `${path} streams a redirect to /sign-in for an anonymous visitor`,
      `status=${page.status}`,
    );
  }

  // --- the APIs refuse an anonymous caller -------------------------------
  for (const path of [
    "/api/staff/school",
    "/api/staff/academic-years",
    "/api/staff/subjects",
    "/api/staff/members",
  ]) {
    const res = await appGetJson(path);
    report.check(
      res.status === 401,
      `an anonymous GET of ${path} is refused (401)`,
      `status=${res.status}`,
    );
  }
  for (const path of [
    "/api/staff/school/update",
    "/api/staff/academic-years",
    "/api/staff/subjects",
    "/api/staff/members/status",
    "/api/staff/assignments",
  ]) {
    const res = await appPostJson(path, {}, undefined);
    report.check(
      res.status === 401,
      `an anonymous POST to ${path} is refused (401)`,
      `status=${res.status}`,
    );
  }

  const sessionA = await signIn(adminA.email, adminA.password);
  const sessionB = await signIn(adminB.email, adminB.password);

  // --- school profile ----------------------------------------------------
  const profile = await appGetJson("/api/staff/school", sessionA.header());
  const originalName = profile.payload?.school?.name;
  const code = profile.payload?.school?.code;
  report.check(
    profile.status === 200 &&
      typeof code === "string" &&
      typeof originalName === "string",
    "an administrator reads the school profile (200)",
    `status=${profile.status}`,
  );

  const blankName = await appPostJson(
    "/api/staff/school/update",
    { name: "  " },
    sessionA.header(),
  );
  report.check(
    blankName.status === 400,
    "a blank school name is refused (400)",
    `status=${blankName.status}`,
  );

  const renamed = await appPostJson(
    "/api/staff/school/update",
    { name: `Alpha ${suffix}` },
    sessionA.header(),
  );
  report.check(
    renamed.status === 200 &&
      renamed.payload?.school?.name === `Alpha ${suffix}` &&
      renamed.payload?.school?.code === code,
    "an administrator renames the school; the code is unchanged (200)",
    `status=${renamed.status}`,
  );

  // Restore the seeded name so later suite runs see the same school.
  if (typeof originalName === "string") {
    await appPostJson(
      "/api/staff/school/update",
      { name: originalName },
      sessionA.header(),
    );
  }

  // --- academic years ----------------------------------------------------
  const yearsBefore = await appGetJson(
    "/api/staff/academic-years",
    sessionA.header(),
  );
  report.check(
    yearsBefore.status === 200 &&
      Array.isArray(yearsBefore.payload?.academicYears),
    "an administrator lists the school's academic years (200)",
    `status=${yearsBefore.status}`,
  );

  const yearName = `AY-${suffix}`;
  const createdYear = await appPostJson(
    "/api/staff/academic-years",
    { name: yearName, startsOn: "2026-09-01", endsOn: "2027-07-31" },
    sessionA.header(),
  );
  const year1Id = createdYear.payload?.academicYear?.id;
  report.check(
    createdYear.status === 201 && typeof year1Id === "string",
    "an administrator creates an academic year (201)",
    `status=${createdYear.status}`,
  );

  const duplicateYear = await appPostJson(
    "/api/staff/academic-years",
    { name: yearName, startsOn: "2026-09-01", endsOn: "2027-07-31" },
    sessionA.header(),
  );
  report.check(
    duplicateYear.status === 409,
    "a duplicate academic year name is refused (409)",
    `status=${duplicateYear.status}`,
  );

  const badDates = await appPostJson(
    "/api/staff/academic-years",
    { name: `AYBAD-${suffix}`, startsOn: "2027-01-01", endsOn: "2026-01-01" },
    sessionA.header(),
  );
  report.check(
    badDates.status === 400,
    "an academic year ending before it starts is refused (400)",
    `status=${badDates.status}`,
  );

  const secondYear = await appPostJson(
    "/api/staff/academic-years",
    { name: `AY2-${suffix}`, startsOn: "2027-09-01", endsOn: "2028-07-31" },
    sessionA.header(),
  );
  const year2Id = secondYear.payload?.academicYear?.id;
  if (secondYear.status !== 201 || !year2Id) {
    throw new Error(`could not create the second year (${secondYear.status})`);
  }

  const madeCurrent = await appPostJson(
    "/api/staff/academic-years/update",
    { academicYearId: year1Id, isCurrent: true },
    sessionA.header(),
  );
  report.check(
    madeCurrent.status === 200 &&
      madeCurrent.payload?.academicYear?.isCurrent === true,
    "an administrator marks a year current (200)",
    `status=${madeCurrent.status}`,
  );

  const switchCurrent = await appPostJson(
    "/api/staff/academic-years/update",
    { academicYearId: year2Id, isCurrent: true },
    sessionA.header(),
  );
  const listedAfter = await appGetJson(
    "/api/staff/academic-years",
    sessionA.header(),
  );
  const yearsNow = listedAfter.payload?.academicYears ?? [];
  const current = yearsNow.filter((row) => row.isCurrent);
  report.check(
    switchCurrent.status === 200 &&
      current.length === 1 &&
      current[0].id === year2Id &&
      yearsNow.find((row) => row.id === year1Id)?.isCurrent === false,
    "marking a year current clears the previously current year",
    `current=${current.length}`,
  );

  const crossYear = await appPostJson(
    "/api/staff/academic-years/update",
    { academicYearId: year1Id, name: "Not Yours" },
    sessionB.header(),
  );
  report.check(
    crossYear.status === 404,
    "another school's administrator cannot change the year (404)",
    `status=${crossYear.status}`,
  );

  // --- terms -------------------------------------------------------------
  const createdTerm = await appPostJson(
    "/api/staff/terms",
    {
      academicYearId: year1Id,
      name: `Term 1 ${suffix}`,
      startsOn: "2026-09-01",
      endsOn: "2026-12-18",
    },
    sessionA.header(),
  );
  const termId = createdTerm.payload?.term?.id;
  report.check(
    createdTerm.status === 201 && typeof termId === "string",
    "an administrator adds a term to a year (201)",
    `status=${createdTerm.status}`,
  );

  const duplicateTerm = await appPostJson(
    "/api/staff/terms",
    {
      academicYearId: year1Id,
      name: `Term 1 ${suffix}`,
      startsOn: "2026-09-01",
      endsOn: "2026-12-18",
    },
    sessionA.header(),
  );
  report.check(
    duplicateTerm.status === 409,
    "a duplicate term name inside the year is refused (409)",
    `status=${duplicateTerm.status}`,
  );

  const renamedTerm = await appPostJson(
    "/api/staff/terms/update",
    { termId, name: `First Term ${suffix}` },
    sessionA.header(),
  );
  report.check(
    renamedTerm.status === 200 &&
      renamedTerm.payload?.term?.name === `First Term ${suffix}`,
    "an administrator renames a term (200)",
    `status=${renamedTerm.status}`,
  );

  const crossTerm = await appPostJson(
    "/api/staff/terms/update",
    { termId, name: "Hijacked" },
    sessionB.header(),
  );
  report.check(
    crossTerm.status === 404,
    "another school's administrator cannot rename the term (404)",
    `status=${crossTerm.status}`,
  );

  // --- subjects ----------------------------------------------------------
  const subjectName = `Subject ${suffix}`;
  const createdSubject = await appPostJson(
    "/api/staff/subjects",
    { name: subjectName, code: `S${suffix}` },
    sessionA.header(),
  );
  const subjectId = createdSubject.payload?.subject?.id;
  report.check(
    createdSubject.status === 201 && typeof subjectId === "string",
    "an administrator creates a subject (201)",
    `status=${createdSubject.status}`,
  );

  const duplicateSubject = await appPostJson(
    "/api/staff/subjects",
    { name: subjectName },
    sessionA.header(),
  );
  report.check(
    duplicateSubject.status === 409,
    "a duplicate subject name is refused (409)",
    `status=${duplicateSubject.status}`,
  );

  const deactivatedSubject = await appPostJson(
    "/api/staff/subjects/update",
    { subjectId, isActive: false },
    sessionA.header(),
  );
  report.check(
    deactivatedSubject.status === 200 &&
      deactivatedSubject.payload?.subject?.isActive === false,
    "an administrator deactivates a subject (200)",
    `status=${deactivatedSubject.status}`,
  );

  const reactivatedSubject = await appPostJson(
    "/api/staff/subjects/update",
    { subjectId, isActive: true },
    sessionA.header(),
  );
  report.check(
    reactivatedSubject.status === 200 &&
      reactivatedSubject.payload?.subject?.isActive === true,
    "an administrator reactivates a subject (200)",
    `status=${reactivatedSubject.status}`,
  );

  const crossSubject = await appPostJson(
    "/api/staff/subjects/update",
    { subjectId, name: "Hijacked" },
    sessionB.header(),
  );
  report.check(
    crossSubject.status === 404,
    "another school's administrator cannot change the subject (404)",
    `status=${crossSubject.status}`,
  );

  // --- staff members -----------------------------------------------------
  const members = await appGetJson("/api/staff/members", sessionA.header());
  const memberRows = members.payload?.members ?? [];
  report.check(
    members.status === 200 &&
      memberRows.some(
        (row) =>
          row.email === adminA.email && row.role === "school_administrator",
      ),
    "an administrator lists the school's staff (200)",
    `status=${members.status} count=${memberRows.length}`,
  );

  // Invite a teacher so there is a second membership to administer.
  const teacherEmail = randomEmail("settings.teacher");
  const teacherPassword = randomPassword();
  const invited = await appPostJson(
    "/api/staff/invite",
    { email: teacherEmail, role: "teacher" },
    sessionA.header(),
  );
  if (invited.status !== 201 || !invited.payload?.activationLink) {
    throw new Error(`could not invite a teacher (status=${invited.status})`);
  }
  const accepted = await appPostJson("/api/staff/invitations/accept", {
    token: tokenFromLink(invited.payload.activationLink),
    password: teacherPassword,
  });
  if (accepted.status !== 200 || accepted.payload?.ok !== true) {
    throw new Error(`teacher could not accept (status=${accepted.status})`);
  }

  const membersWithTeacher = await appGetJson(
    "/api/staff/members",
    sessionA.header(),
  );
  const teacher = (membersWithTeacher.payload?.members ?? []).find(
    (row) => row.email === teacherEmail,
  );
  if (!teacher) {
    throw new Error("the invited teacher is missing from the member list");
  }

  const suspended = await appPostJson(
    "/api/staff/members/status",
    { membershipId: teacher.membershipId, action: "suspend" },
    sessionA.header(),
  );
  report.check(
    suspended.status === 200 && suspended.payload?.status === "suspended",
    "an administrator suspends a staff member (200)",
    `status=${suspended.status}`,
  );

  const suspendedList = await appGetJson(
    "/api/staff/members",
    sessionA.header(),
  );
  report.check(
    (suspendedList.payload?.members ?? []).find(
      (row) => row.membershipId === teacher.membershipId,
    )?.status === "suspended",
    "the suspended member shows as suspended in the list",
  );

  const restored = await appPostJson(
    "/api/staff/members/status",
    { membershipId: teacher.membershipId, action: "restore" },
    sessionA.header(),
  );
  report.check(
    restored.status === 200 && restored.payload?.status === "active",
    "an administrator restores a suspended member (200)",
    `status=${restored.status}`,
  );

  const revoked = await appPostJson(
    "/api/staff/members/status",
    { membershipId: teacher.membershipId, action: "revoke" },
    sessionA.header(),
  );
  report.check(
    revoked.status === 200 && revoked.payload?.status === "revoked",
    "an administrator revokes a member (200)",
    `status=${revoked.status}`,
  );

  // A revoked membership keeps its row: nothing is hard-deleted.
  const { data: teacherRow } = await admin
    .from("school_members")
    .select("id, status")
    .eq("id", teacher.membershipId)
    .maybeSingle();
  report.check(
    teacherRow?.status === "revoked",
    "revoking a member is a state change, never a deletion",
    `status=${teacherRow?.status}`,
  );

  const crossStatus = await appPostJson(
    "/api/staff/members/status",
    { membershipId: teacher.membershipId, action: "suspend" },
    sessionB.header(),
  );
  report.check(
    crossStatus.status === 404,
    "another school's administrator cannot change the membership (404)",
    `status=${crossStatus.status}`,
  );

  // Return the teacher membership to active for the assignment checks.
  await appPostJson(
    "/api/staff/members/status",
    { membershipId: teacher.membershipId, action: "restore" },
    sessionA.header(),
  );

  // --- assignments -------------------------------------------------------
  const assignment = await appPostJson(
    "/api/staff/assignments",
    { membershipId: teacher.membershipId, classId: aClassId },
    sessionA.header(),
  );
  const assignmentId = assignment.payload?.assignmentId;
  report.check(
    assignment.status === 201 && typeof assignmentId === "string",
    "an administrator assigns a member to a class (201)",
    `status=${assignment.status}`,
  );

  const duplicateAssignment = await appPostJson(
    "/api/staff/assignments",
    { membershipId: teacher.membershipId, classId: aClassId },
    sessionA.header(),
  );
  report.check(
    duplicateAssignment.status === 409,
    "the same assignment twice is refused (409)",
    `status=${duplicateAssignment.status}`,
  );

  const noTarget = await appPostJson(
    "/api/staff/assignments",
    { membershipId: teacher.membershipId },
    sessionA.header(),
  );
  report.check(
    noTarget.status === 400,
    "an assignment with neither a class nor a subject is refused (400)",
    `status=${noTarget.status}`,
  );

  const crossAssignment = await appPostJson(
    "/api/staff/assignments",
    { membershipId: teacher.membershipId, classId: bClassId },
    sessionA.header(),
  );
  report.check(
    crossAssignment.status === 400,
    "assigning a member to another school's class is refused (400)",
    `status=${crossAssignment.status}`,
  );

  const listedAssignment = await appGetJson(
    "/api/staff/members",
    sessionA.header(),
  );
  report.check(
    (listedAssignment.payload?.members ?? []).some(
      (row) =>
        row.membershipId === teacher.membershipId &&
        row.assignments.some((a) => a.id === assignmentId),
    ),
    "the new assignment appears on the member",
  );

  const removed = await appPostJson(
    "/api/staff/assignments/delete",
    { assignmentId },
    sessionA.header(),
  );
  report.check(
    removed.status === 200 && removed.payload?.ok === true,
    "an administrator removes an assignment (200)",
    `status=${removed.status}`,
  );

  const crossDelete = await appPostJson(
    "/api/staff/assignments/delete",
    { assignmentId: crypto.randomUUID() },
    sessionB.header(),
  );
  report.check(
    crossDelete.status === 404,
    "an unknown assignment is not found (404)",
    `status=${crossDelete.status}`,
  );

  // School B's member list must never expose school A's staff.
  const membersB = await appGetJson("/api/staff/members", sessionB.header());
  report.check(
    membersB.status === 200 &&
      !(membersB.payload?.members ?? []).some(
        (row) => row.email === adminA.email,
      ),
    "school B's administrator cannot see school A's staff",
    `status=${membersB.status}`,
  );

  // --- a permission-less teacher is refused ------------------------------
  const teacherJar = await signIn(teacherEmail, teacherPassword);
  const teacherRequests = [
    { method: "get", path: "/api/staff/school" },
    { method: "get", path: "/api/staff/academic-years" },
    { method: "get", path: "/api/staff/members" },
    { method: "post", path: "/api/staff/subjects", body: { name: "Nope" } },
    {
      method: "post",
      path: "/api/staff/subjects/update",
      body: { subjectId, isActive: false },
    },
    {
      method: "post",
      path: "/api/staff/academic-years",
      body: { name: "Nope", startsOn: "2026-01-01", endsOn: "2026-02-01" },
    },
    {
      method: "post",
      path: "/api/staff/members/status",
      body: { membershipId: teacher.membershipId, action: "suspend" },
    },
    {
      method: "post",
      path: "/api/staff/assignments",
      body: { membershipId: teacher.membershipId, classId: aClassId },
    },
  ];
  for (const req of teacherRequests) {
    const res =
      req.method === "get"
        ? await appGetJson(req.path, teacherJar.header())
        : await appPostJson(req.path, req.body, teacherJar.header());
    report.check(
      res.status === 403,
      `a teacher is refused ${req.method.toUpperCase()} ${req.path} (403)`,
      `status=${res.status}`,
    );
  }

  process.exitCode = report.summary() ? 0 : 1;
}

main().catch((error) => {
  console.error("administration settings test error:", error.message ?? error);
  process.exit(1);
});
