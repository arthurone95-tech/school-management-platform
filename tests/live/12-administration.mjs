// Live check 12: Phase 3 school administration (D-028).
//
// Covers, through the running app and the real database:
//   * POST /api/staff/classes            — create a class
//   * POST /api/staff/classes/update     — rename / activate / deactivate
//   * POST /api/staff/learners/detail    — read one full record
//   * POST /api/staff/learners/update    — correct a record
//   * POST /api/staff/learners/status    — deactivate / reactivate
//   * POST /api/staff/learners/placement — change the current class
// including identity, school scoping, the class.manage / learner.update /
// learner.placement.manage permissions, cross-school denial, validation,
// duplicate handling, the inactive-only list view, and the one-open-placement
// invariant in the database. It also re-checks that a permission-less teacher
// is refused and that the new page streams a redirect for anonymous visitors.
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

const state = loadState();
const report = createReporter("administration");

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

/** Open placements for a learner, as stored. */
async function openPlacements(admin, learnerId) {
  const { data } = await admin
    .from("learner_class_placements")
    .select("id, school_id, class_id, ended_at")
    .eq("learner_id", learnerId);
  return data ?? [];
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

  const admin = adminClient();
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();

  // School B's class, for the cross-school attempts.
  const { data: bClasses } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", state.schools.B);
  const bClassId = bClasses?.[0]?.id;
  if (!bClassId) {
    throw new Error("school B has no seeded class");
  }

  // --- anonymous access is refused ---------------------------------------
  const anonCreates = await appPostJson("/api/staff/classes", { name: "X" });
  report.check(
    anonCreates.status === 401,
    "POST /api/staff/classes without a session is rejected (401)",
    `status=${anonCreates.status}`,
  );

  const anonUpdates = await appPostJson("/api/staff/classes/update", {});
  report.check(
    anonUpdates.status === 401,
    "POST /api/staff/classes/update without a session is rejected (401)",
    `status=${anonUpdates.status}`,
  );

  const anonDetail = await appPostJson("/api/staff/learners/detail", {});
  report.check(
    anonDetail.status === 401,
    "POST /api/staff/learners/detail without a session is rejected (401)",
    `status=${anonDetail.status}`,
  );

  const anonCorrect = await appPostJson("/api/staff/learners/update", {});
  report.check(
    anonCorrect.status === 401,
    "POST /api/staff/learners/update without a session is rejected (401)",
    `status=${anonCorrect.status}`,
  );

  const anonStatus = await appPostJson("/api/staff/learners/status", {});
  report.check(
    anonStatus.status === 401,
    "POST /api/staff/learners/status without a session is rejected (401)",
    `status=${anonStatus.status}`,
  );

  const anonPlacement = await appPostJson("/api/staff/learners/placement", {});
  report.check(
    anonPlacement.status === 401,
    "POST /api/staff/learners/placement without a session is rejected (401)",
    `status=${anonPlacement.status}`,
  );

  const anonPage = await appGetRaw("/dashboard/classes");
  report.check(
    anonPage.status === 200 &&
      anonPage.body.includes("/sign-in") &&
      anonPage.body.includes('http-equiv="refresh"'),
    "/dashboard/classes streams a redirect to /sign-in for an anonymous visitor",
    `status=${anonPage.status}`,
  );

  const sessionA = await signIn(adminA.email, adminA.password);
  const sessionB = await signIn(adminB.email, adminB.password);

  const pageA = await appGetRaw("/dashboard/classes", sessionA.header());
  report.check(
    pageA.status === 200 &&
      pageA.body.includes("Create a class") &&
      pageA.body.includes("Your classes"),
    "/dashboard/classes renders the class manager for a signed-in administrator",
    `status=${pageA.status}`,
  );

  // --- classes: create, duplicate, validate, list -------------------------
  const className = `Admin ${suffix}`;
  const created = await appPostJson(
    "/api/staff/classes",
    { name: className },
    sessionA.header(),
  );
  const newClass = created.payload?.klass;
  report.check(
    created.status === 201 &&
      created.payload?.ok === true &&
      typeof newClass?.id === "string" &&
      newClass?.name === className &&
      newClass?.isActive === true,
    "an administrator creates a class (201)",
    `status=${created.status} name=${newClass?.name}`,
  );

  const exactDuplicate = await appPostJson(
    "/api/staff/classes",
    { name: className },
    sessionA.header(),
  );
  report.check(
    exactDuplicate.status === 409,
    "a duplicate class name in the same school is refused (409)",
    `status=${exactDuplicate.status}`,
  );

  const nearDuplicate = await appPostJson(
    "/api/staff/classes",
    { name: className.toLowerCase() },
    sessionA.header(),
  );
  report.check(
    nearDuplicate.status === 409,
    "a class name differing only in case is refused (409)",
    `status=${nearDuplicate.status}`,
  );

  const blankName = await appPostJson(
    "/api/staff/classes",
    { name: "   " },
    sessionA.header(),
  );
  report.check(
    blankName.status === 400,
    "a blank class name is refused before any write (400)",
    `status=${blankName.status}`,
  );

  const withInactive = await appGetJson(
    "/api/staff/classes?includeInactive=true",
    sessionA.header(),
  );
  report.check(
    withInactive.status === 200 &&
      (withInactive.payload?.classes ?? []).some(
        (row) => row.id === newClass?.id,
      ),
    "the new class appears in the school's class list",
    `status=${withInactive.status} count=${withInactive.payload?.classes?.length}`,
  );

  // --- classes: rename, deactivate, reactivate ---------------------------
  const renamedName = `${className} B`;
  const renamed = await appPostJson(
    "/api/staff/classes/update",
    { classId: newClass?.id, name: renamedName },
    sessionA.header(),
  );
  report.check(
    renamed.status === 200 && renamed.payload?.klass?.name === renamedName,
    "an administrator renames a class (200)",
    `status=${renamed.status} name=${renamed.payload?.klass?.name}`,
  );

  const renameCollision = await appPostJson(
    "/api/staff/classes/update",
    { classId: newClass?.id, name: "Primary 1" },
    sessionA.header(),
  );
  report.check(
    renameCollision.status === 409,
    "renaming a class onto another class's name is refused (409)",
    `status=${renameCollision.status}`,
  );

  const noChange = await appPostJson(
    "/api/staff/classes/update",
    { classId: newClass?.id },
    sessionA.header(),
  );
  report.check(
    noChange.status === 400,
    "a class update with nothing to change is refused (400)",
    `status=${noChange.status}`,
  );

  const deactivated = await appPostJson(
    "/api/staff/classes/update",
    { classId: newClass?.id, isActive: false },
    sessionA.header(),
  );
  report.check(
    deactivated.status === 200 &&
      deactivated.payload?.klass?.isActive === false,
    "an administrator deactivates a class (200)",
    `status=${deactivated.status} isActive=${deactivated.payload?.klass?.isActive}`,
  );

  const activeOnly = await appGetJson("/api/staff/classes", sessionA.header());
  report.check(
    activeOnly.status === 200 &&
      !(activeOnly.payload?.classes ?? []).some(
        (row) => row.id === newClass?.id,
      ),
    "a deactivated class is hidden from the active-class selector",
    `status=${activeOnly.status} count=${activeOnly.payload?.classes?.length}`,
  );

  const stillListed = await appGetJson(
    "/api/staff/classes?includeInactive=true",
    sessionA.header(),
  );
  report.check(
    (stillListed.payload?.classes ?? []).some(
      (row) => row.id === newClass?.id && row.isActive === false,
    ),
    "a deactivated class is still listed for reactivation",
  );

  const reactivated = await appPostJson(
    "/api/staff/classes/update",
    { classId: newClass?.id, isActive: true },
    sessionA.header(),
  );
  report.check(
    reactivated.status === 200 && reactivated.payload?.klass?.isActive === true,
    "an administrator reactivates a class (200)",
    `status=${reactivated.status}`,
  );

  const crossRename = await appPostJson(
    "/api/staff/classes/update",
    { classId: bClassId, name: "Not Yours" },
    sessionA.header(),
  );
  report.check(
    crossRename.status === 404,
    "renaming another school's class is refused (404)",
    `status=${crossRename.status}`,
  );

  // --- a learner to administer -------------------------------------------
  const classOne = newClass?.id;
  const registration = `ADMIN-${suffix}`;
  const learnerBody = {
    registrationNumber: registration,
    firstName: "Yaa",
    lastName: "Asante",
    gender: "female",
    dateOfBirth: "2015-06-12",
    residentialAddress: "7 Admin Road, Accra",
    guardianPhone: "+233200000020",
    guardianEmail: "guardian@example.com",
    classId: classOne,
  };
  const enrolled = await appPostJson(
    "/api/staff/learners",
    learnerBody,
    sessionA.header(),
  );
  const learnerId = enrolled.payload?.learner?.id;
  if (enrolled.status !== 201 || !learnerId) {
    throw new Error(`could not enrol a learner (status=${enrolled.status})`);
  }
  const username = enrolled.payload.learner.username;

  const detail = await appPostJson(
    "/api/staff/learners/detail",
    { learnerId },
    sessionA.header(),
  );
  report.check(
    detail.status === 200 &&
      detail.payload?.learner?.residentialAddress ===
        learnerBody.residentialAddress &&
      detail.payload?.learner?.guardianPhone === learnerBody.guardianPhone,
    "an administrator reads one student's full record (200)",
    `status=${detail.status}`,
  );

  const crossDetail = await appPostJson(
    "/api/staff/learners/detail",
    { learnerId },
    sessionB.header(),
  );
  report.check(
    crossDetail.status === 404,
    "another school's administrator cannot read the record (404)",
    `status=${crossDetail.status}`,
  );

  // --- learner correction ------------------------------------------------
  const corrected = await appPostJson(
    "/api/staff/learners/update",
    { learnerId, lastName: "Asante-Boateng" },
    sessionA.header(),
  );
  report.check(
    corrected.status === 200 &&
      corrected.payload?.learner?.lastName === "Asante-Boateng" &&
      corrected.payload?.learner?.username === username,
    "an administrator corrects a student's name (200)",
    `status=${corrected.status} lastName=${corrected.payload?.learner?.lastName}`,
  );

  const detailAfter = await appPostJson(
    "/api/staff/learners/detail",
    { learnerId },
    sessionA.header(),
  );
  report.check(
    detailAfter.payload?.learner?.lastName === "Asante-Boateng" &&
      detailAfter.payload?.learner?.firstName === "Yaa" &&
      detailAfter.payload?.learner?.registrationNumber === registration,
    "only the corrected field changed; the rest of the record is intact",
  );

  const emptyCorrection = await appPostJson(
    "/api/staff/learners/update",
    { learnerId },
    sessionA.header(),
  );
  report.check(
    emptyCorrection.status === 400,
    "a correction with no fields is refused (400)",
    `status=${emptyCorrection.status}`,
  );

  const duplicateRegistration = await appPostJson(
    "/api/staff/learners/update",
    { learnerId, registrationNumber: "ALPHA-001" },
    sessionA.header(),
  );
  report.check(
    duplicateRegistration.status === 409,
    "correcting onto a registration number used in the school is refused (409)",
    `status=${duplicateRegistration.status}`,
  );

  const crossCorrection = await appPostJson(
    "/api/staff/learners/update",
    { learnerId, lastName: "Hacked" },
    sessionB.header(),
  );
  report.check(
    crossCorrection.status === 404,
    "another school's administrator cannot correct the record (404)",
    `status=${crossCorrection.status}`,
  );

  // --- learner status ----------------------------------------------------
  const beforeActive = await appGetJson(
    "/api/staff/learners",
    sessionA.header(),
  );
  const beforeActiveTotal = beforeActive.payload?.total ?? 0;

  const deactivate = await appPostJson(
    "/api/staff/learners/status",
    { learnerId, status: "inactive" },
    sessionA.header(),
  );
  report.check(
    deactivate.status === 200 &&
      deactivate.payload?.learner?.status === "inactive",
    "an administrator deactivates a student (200)",
    `status=${deactivate.status}`,
  );

  const defaultList = await appGetJson(
    "/api/staff/learners",
    sessionA.header(),
  );
  report.check(
    defaultList.payload?.total === beforeActiveTotal - 1 &&
      !(defaultList.payload?.learners ?? []).some(
        (row) => row.id === learnerId,
      ),
    "a deactivated student leaves the routine (active) list",
    `total=${defaultList.payload?.total} expected=${beforeActiveTotal - 1}`,
  );

  const inactiveList = await appGetJson(
    "/api/staff/learners?status=inactive",
    sessionA.header(),
  );
  report.check(
    inactiveList.status === 200 &&
      (inactiveList.payload?.learners ?? []).some(
        (row) => row.id === learnerId && row.status === "inactive",
      ),
    "the explicit inactive view lists the deactivated student",
    `status=${inactiveList.status} total=${inactiveList.payload?.total}`,
  );

  const deactivateAgain = await appPostJson(
    "/api/staff/learners/status",
    { learnerId, status: "inactive" },
    sessionA.header(),
  );
  report.check(
    deactivateAgain.status === 200,
    "deactivating an already inactive student is a harmless no-op (200)",
    `status=${deactivateAgain.status}`,
  );

  const badStatus = await appPostJson(
    "/api/staff/learners/status",
    { learnerId, status: "removed" },
    sessionA.header(),
  );
  report.check(
    badStatus.status === 400,
    "an unsupported student status is refused (400)",
    `status=${badStatus.status}`,
  );

  // --- placement ---------------------------------------------------------
  const { data: aClasses } = await admin
    .from("classes")
    .select("id, name")
    .eq("school_id", state.schools.A);
  const primaryA = (aClasses ?? []).find((row) => row.name === "Primary 1");

  const inactivePlaced = await appPostJson(
    "/api/staff/learners/placement",
    { learnerId, classId: primaryA?.id ?? bClassId },
    sessionA.header(),
  );
  report.check(
    inactivePlaced.status === 409,
    "an inactive student cannot be moved to another class (409)",
    `status=${inactivePlaced.status}`,
  );

  const reactivate = await appPostJson(
    "/api/staff/learners/status",
    { learnerId, status: "active" },
    sessionA.header(),
  );
  report.check(
    reactivate.status === 200 &&
      reactivate.payload?.learner?.status === "active",
    "an administrator reactivates a student (200)",
    `status=${reactivate.status}`,
  );

  if (!primaryA?.id) {
    throw new Error("school A has no seeded Primary 1 class");
  }

  const moved = await appPostJson(
    "/api/staff/learners/placement",
    { learnerId, classId: primaryA.id },
    sessionA.header(),
  );
  report.check(
    moved.status === 200 &&
      moved.payload?.ok === true &&
      moved.payload?.unchanged === false &&
      moved.payload?.learner?.className === "Primary 1",
    "an administrator moves a student to another class (200)",
    `status=${moved.status} class=${moved.payload?.learner?.className}`,
  );

  const rows = await openPlacements(admin, learnerId);
  const open = rows.filter((row) => row.ended_at === null);
  const closed = rows.filter((row) => row.ended_at !== null);
  report.check(
    rows.length === 2 &&
      open.length === 1 &&
      open[0].class_id === primaryA.id &&
      closed.length === 1 &&
      closed[0].class_id === classOne &&
      rows.every((row) => row.school_id === state.schools.A),
    "the change ends the old placement and opens exactly one new one",
    `rows=${rows.length} open=${open.length} closed=${closed.length}`,
  );

  const sameClass = await appPostJson(
    "/api/staff/learners/placement",
    { learnerId, classId: primaryA.id },
    sessionA.header(),
  );
  const sameRows = await openPlacements(admin, learnerId);
  report.check(
    sameClass.status === 200 &&
      sameClass.payload?.unchanged === true &&
      sameRows.length === 2,
    "moving a student to their current class is a no-op (200, no new row)",
    `status=${sameClass.status} rows=${sameRows.length}`,
  );

  const crossPlacement = await appPostJson(
    "/api/staff/learners/placement",
    { learnerId, classId: bClassId },
    sessionA.header(),
  );
  report.check(
    crossPlacement.status === 400,
    "moving a student into another school's class is refused (400)",
    `status=${crossPlacement.status}`,
  );

  const crossMove = await appPostJson(
    "/api/staff/learners/placement",
    { learnerId, classId: primaryA.id },
    sessionB.header(),
  );
  report.check(
    crossMove.status === 404,
    "another school's administrator cannot move the student (404)",
    `status=${crossMove.status}`,
  );

  const unknownLearner = await appPostJson(
    "/api/staff/learners/placement",
    { learnerId: crypto.randomUUID(), classId: primaryA.id },
    sessionA.header(),
  );
  report.check(
    unknownLearner.status === 404,
    "moving an unknown student is refused (404)",
    `status=${unknownLearner.status}`,
  );

  // --- recovery: a student with no open placement can be placed again -----
  const orphanBody = { ...learnerBody, registrationNumber: `ADMIN-O${suffix}` };
  const orphan = await appPostJson(
    "/api/staff/learners",
    orphanBody,
    sessionA.header(),
  );
  const orphanId = orphan.payload?.learner?.id;
  if (orphan.status !== 201 || !orphanId) {
    throw new Error(`could not enrol the orphan learner (${orphan.status})`);
  }
  // Simulate the partial failure recorded in D-027: the learner exists but the
  // placement is missing.
  await admin
    .from("learner_class_placements")
    .delete()
    .eq("learner_id", orphanId);

  const repaired = await appPostJson(
    "/api/staff/learners/placement",
    { learnerId: orphanId, classId: primaryA.id },
    sessionA.header(),
  );
  const orphanRows = await openPlacements(admin, orphanId);
  report.check(
    repaired.status === 200 &&
      orphanRows.length === 1 &&
      orphanRows[0].ended_at === null &&
      orphanRows[0].class_id === primaryA.id,
    "a student whose placement is missing can be placed again",
    `status=${repaired.status} rows=${orphanRows.length}`,
  );

  // --- a permission-less teacher is refused ------------------------------
  const teacherEmail = randomEmail("admin.teacher");
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

  const teacherJar = await signIn(teacherEmail, teacherPassword);
  const teacherChecks = [
    ["/api/staff/classes", { name: "Nope" }, "class.manage"],
    ["/api/staff/classes/update", { classId: newClass?.id }, "class.manage"],
    [
      "/api/staff/learners/update",
      { learnerId, lastName: "X" },
      "learner.update",
    ],
    [
      "/api/staff/learners/status",
      { learnerId, status: "inactive" },
      "learner.update",
    ],
    [
      "/api/staff/learners/placement",
      { learnerId, classId: primaryA.id },
      "learner.placement.manage",
    ],
  ];
  for (const [path, body, permission] of teacherChecks) {
    const res = await appPostJson(path, body, teacherJar.header());
    report.check(
      res.status === 403,
      `a teacher without ${permission} is refused ${path} (403)`,
      `status=${res.status}`,
    );
  }

  const teacherDetail = await appPostJson(
    "/api/staff/learners/detail",
    { learnerId },
    teacherJar.header(),
  );
  report.check(
    teacherDetail.status === 403,
    "a teacher without learner.read cannot read a student record (403)",
    `status=${teacherDetail.status}`,
  );

  const teacherPage = await appGetRaw(
    "/dashboard/classes",
    teacherJar.header(),
  );
  report.check(
    teacherPage.status === 200 &&
      teacherPage.body.includes("cannot view classes"),
    "/dashboard/classes tells a teacher their role cannot view classes",
    `status=${teacherPage.status}`,
  );

  process.exitCode = report.summary() ? 0 : 1;
}

main().catch((error) => {
  console.error("administration test error:", error.message ?? error);
  process.exit(1);
});
