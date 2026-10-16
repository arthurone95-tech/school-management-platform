// Live check 11: student enrolment and class placement (D-018) — the first
// end-to-end school workflow.
//
// Covers, through the running app and the real database:
//   * GET  /api/staff/classes   — the class selector source
//   * GET  /api/staff/learners  — listing with the current placement
//   * POST /api/staff/learners  — register + place in one request
// including identity, school scoping, the learner.read / learner.create
// permissions, cross-school denial, duplicate handling, input validation and
// the persisted placement. It also re-checks tenant isolation on the new
// tables and that a permission-less teacher is refused.
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
const report = createReporter("enrolment");

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

  // School B's class, used for the cross-school placement attempt.
  const { data: bClasses } = await admin
    .from("classes")
    .select("id, name")
    .eq("school_id", state.schools.B);
  const bClassId = bClasses?.[0]?.id;
  if (!bClassId) {
    throw new Error("school B has no seeded class");
  }

  // --- anonymous access is refused ---------------------------------------
  const anonClasses = await appGetJson("/api/staff/classes");
  report.check(
    anonClasses.status === 401,
    "GET /api/staff/classes without a session is rejected (401)",
    `status=${anonClasses.status}`,
  );

  const anonLearners = await appGetJson("/api/staff/learners");
  report.check(
    anonLearners.status === 401,
    "GET /api/staff/learners without a session is rejected (401)",
    `status=${anonLearners.status}`,
  );

  const anonPost = await appPostJson("/api/staff/learners", {});
  report.check(
    anonPost.status === 401,
    "POST /api/staff/learners without a session is rejected (401)",
    `status=${anonPost.status}`,
  );

  // Under Partial Prerender the shell is served with 200 and the redirect
  // streams in, exactly as for /dashboard.
  const anonPage = await appGetRaw("/dashboard/learners");
  report.check(
    anonPage.status === 200 &&
      anonPage.body.includes("/sign-in") &&
      anonPage.body.includes('http-equiv="refresh"'),
    "/dashboard/learners streams a redirect to /sign-in for an anonymous visitor",
    `status=${anonPage.status}`,
  );

  // --- the school administrator ------------------------------------------
  const sessionA = await signIn(adminA.email, adminA.password);

  const pageA = await appGetRaw("/dashboard/learners", sessionA.header());
  report.check(
    pageA.status === 200 &&
      pageA.body.includes("Enrol a student") &&
      pageA.body.includes("First name") &&
      pageA.body.includes("Guardian phone") &&
      pageA.body.includes("Register student"),
    "/dashboard/learners renders the enrolment form for a signed-in administrator",
    `status=${pageA.status}`,
  );

  const classesA = await appGetJson("/api/staff/classes", sessionA.header());
  const primary = (classesA.payload?.classes ?? []).find(
    (row) => row.name === "Primary 1",
  );
  report.check(
    classesA.status === 200 &&
      Array.isArray(classesA.payload?.classes) &&
      Boolean(primary),
    "an administrator can list the school's active classes",
    `status=${classesA.status} count=${classesA.payload?.classes?.length}`,
  );
  const classAId = primary?.id ?? classesA.payload?.classes?.[0]?.id;

  const before = await appGetJson("/api/staff/learners", sessionA.header());
  const beforeTotal = before.payload?.total ?? 0;
  report.check(
    before.status === 200 && Array.isArray(before.payload?.learners),
    "an administrator can list the school's students",
    `status=${before.status} total=${beforeTotal}`,
  );

  // --- register and place a student --------------------------------------
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  const body = {
    registrationNumber: `ENROL-${suffix}`,
    firstName: "Kwame",
    lastName: "Adjei",
    gender: "male",
    dateOfBirth: "2016-02-03",
    residentialAddress: "5 Test Street, Kumasi",
    guardianPhone: "+233200000010",
    guardianEmail: "guardian@example.com",
    classId: classAId,
  };

  const created = await appPostJson(
    "/api/staff/learners",
    body,
    sessionA.header(),
  );
  const learner = created.payload?.learner;
  report.check(
    created.status === 201 &&
      created.payload?.ok === true &&
      typeof learner?.id === "string" &&
      typeof learner?.username === "string",
    "registering a student with a class returns the new student (201)",
    `status=${created.status} username=${learner?.username}`,
  );
  report.check(
    learner?.className === "Primary 1",
    "the response reports the student's class placement",
    `className=${learner?.className}`,
  );

  const after = await appGetJson("/api/staff/learners", sessionA.header());
  const found = (after.payload?.learners ?? []).find(
    (row) => row.id === learner?.id,
  );
  report.check(
    after.payload?.total === beforeTotal + 1 && Boolean(found),
    "the new student appears in the list and the total grows by one",
    `total=${after.payload?.total} expected=${beforeTotal + 1}`,
  );
  report.check(
    found?.className === "Primary 1" &&
      found?.registrationNumber === body.registrationNumber &&
      found?.status === "active",
    "the listed student carries the class, registration number and status",
    `class=${found?.className} reg=${found?.registrationNumber}`,
  );

  // --- the placement is persisted, tenant-consistent, and open ------------
  const { data: placements } = await admin
    .from("learner_class_placements")
    .select("id, school_id, class_id, ended_at")
    .eq("learner_id", learner?.id);
  report.check(
    placements?.length === 1 &&
      placements[0].school_id === state.schools.A &&
      placements[0].class_id === classAId &&
      placements[0].ended_at === null,
    "one open placement is stored, in the student's own school and class",
    `rows=${placements?.length} school=${placements?.[0]?.school_id}`,
  );

  const { data: learnerRow } = await admin
    .from("learners")
    .select("school_id, guardian_email")
    .eq("id", learner?.id)
    .maybeSingle();
  report.check(
    learnerRow?.school_id === state.schools.A,
    "the student is recorded against the caller's school only",
    `school=${learnerRow?.school_id}`,
  );

  // --- duplicate and invalid input ---------------------------------------
  const duplicate = await appPostJson(
    "/api/staff/learners",
    body,
    sessionA.header(),
  );
  report.check(
    duplicate.status === 409,
    "a duplicate registration number in the same school is refused (409)",
    `status=${duplicate.status}`,
  );

  const badGender = await appPostJson(
    "/api/staff/learners",
    { ...body, registrationNumber: `ENROL-X${suffix}`, gender: "unknown" },
    sessionA.header(),
  );
  report.check(
    badGender.status === 400,
    "an invalid gender is refused before any write (400)",
    `status=${badGender.status}`,
  );

  const futureDob = await appPostJson(
    "/api/staff/learners",
    {
      ...body,
      registrationNumber: `ENROL-F${suffix}`,
      dateOfBirth: "2999-01-01",
    },
    sessionA.header(),
  );
  report.check(
    futureDob.status === 400,
    "a future date of birth is refused (400)",
    `status=${futureDob.status}`,
  );

  const crossClass = await appPostJson(
    "/api/staff/learners",
    { ...body, registrationNumber: `ENROL-B${suffix}`, classId: bClassId },
    sessionA.header(),
  );
  report.check(
    crossClass.status === 400,
    "placing a student in another school's class is refused (400)",
    `status=${crossClass.status}`,
  );

  // --- username collision on an identical name ---------------------------
  const twin = await appPostJson(
    "/api/staff/learners",
    { ...body, registrationNumber: `ENROL-T${suffix}` },
    sessionA.header(),
  );
  report.check(
    twin.status === 201 &&
      typeof twin.payload?.learner?.username === "string" &&
      twin.payload.learner.username !== learner?.username,
    "two students with the same name receive distinct usernames",
    `first=${learner?.username} second=${twin.payload?.learner?.username}`,
  );

  // --- cross-school isolation --------------------------------------------
  const sessionB = await signIn(adminB.email, adminB.password);
  const listB = await appGetJson("/api/staff/learners", sessionB.header());
  const leaked = (listB.payload?.learners ?? []).some(
    (row) => row.id === learner?.id,
  );
  report.check(
    listB.status === 200 && leaked === false,
    "school B's administrator cannot see school A's students",
    `status=${listB.status} leaked=${leaked}`,
  );

  const bClassesSeen = await appGetJson(
    "/api/staff/classes",
    sessionB.header(),
  );
  report.check(
    (bClassesSeen.payload?.classes ?? []).every((row) => row.id !== classAId),
    "school B's class list never contains school A's class",
    `count=${bClassesSeen.payload?.classes?.length}`,
  );

  // --- a permission-less teacher is refused ------------------------------
  const teacherEmail = randomEmail("enrol.teacher");
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
  const teacherList = await appGetJson(
    "/api/staff/learners",
    teacherJar.header(),
  );
  report.check(
    teacherList.status === 403,
    "a teacher without learner.read cannot list students (403)",
    `status=${teacherList.status}`,
  );
  const teacherPost = await appPostJson(
    "/api/staff/learners",
    { ...body, registrationNumber: `ENROL-P${suffix}` },
    teacherJar.header(),
  );
  report.check(
    teacherPost.status === 403,
    "a teacher without learner.create cannot register a student (403)",
    `status=${teacherPost.status}`,
  );
  const teacherClasses = await appGetJson(
    "/api/staff/classes",
    teacherJar.header(),
  );
  report.check(
    teacherClasses.status === 403,
    "a teacher without class.read cannot list classes (403)",
    `status=${teacherClasses.status}`,
  );

  process.exitCode = report.summary() ? 0 : 1;
}

main().catch((error) => {
  console.error("enrolment test error:", error.message ?? error);
  process.exit(1);
});
