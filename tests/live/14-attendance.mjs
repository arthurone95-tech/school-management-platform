// Live check 14: Phase 4 class attendance (D-030).
//
// Covers, through the running app and the real database:
//   * GET  /api/staff/attendance/options      — the caller's classes and subjects
//   * GET/POST /api/staff/attendance/sessions — list / open a register
//   * GET/POST /api/staff/attendance/register — read / write the whole register
//   * GET  /api/staff/attendance/report       — the administrator's class report
//
// including the teacher class scope (the security point of this slice), the
// correction window, validation, duplicates, cross-school denial, auditing, and
// the fact that a teacher is refused the report while a teacher assigned to no
// class can reach no register at all. It also re-checks that the new page
// streams a redirect for anonymous visitors.
//
// The suite is re-runnable. Attendance is never deleted, so each run works with
// a subject it creates and with a past date it has confirmed has no register
// yet, which keeps the report assertions exact instead of cumulative.
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

const report = createReporter("attendance");

function randomEmail(prefix) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@exampleschool.example`;
}

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

/** A calendar date `days` before today, in UTC (the server's rule, D-030). */
function dateDaysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
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
  const sessionA = await signIn(adminA.email, adminA.password);
  const sessionB = await signIn(adminB.email, adminB.password);
  const todayIso = dateDaysAgo(0);

  const { data: aClasses } = await admin
    .from("classes")
    .select("id, name")
    .eq("school_id", state.schools.A);
  const assignedClass = aClasses?.[0]?.id;
  const otherClass = aClasses?.[1]?.id;
  const { data: bClasses } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", state.schools.B);
  const bClassId = bClasses?.[0]?.id;

  if (!assignedClass || !otherClass || !bClassId) {
    throw new Error("a school has fewer than the classes this check needs");
  }

  // --- pages redirect an anonymous visitor -------------------------------
  const page = await appGetRaw("/dashboard/attendance");
  report.check(
    page.status === 200 &&
      page.body.includes("/sign-in") &&
      page.body.includes('http-equiv="refresh"'),
    "/dashboard/attendance streams a redirect to /sign-in for an anonymous visitor",
    `status=${page.status}`,
  );

  // --- the APIs refuse an anonymous caller -------------------------------
  for (const path of [
    "/api/staff/attendance/options",
    "/api/staff/attendance/sessions",
    "/api/staff/attendance/report",
  ]) {
    const res = await appGetJson(path);
    report.check(
      res.status === 401,
      `an anonymous GET of ${path} is refused (401)`,
      `status=${res.status}`,
    );
  }
  for (const path of [
    "/api/staff/attendance/sessions",
    "/api/staff/attendance/register",
  ]) {
    const res = await appPostJson(path, {}, undefined);
    report.check(
      res.status === 401,
      `an anonymous POST to ${path} is refused (401)`,
      `status=${res.status}`,
    );
  }

  // --- a subject unique to this run --------------------------------------
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  const subject = await appPostJson(
    "/api/staff/subjects",
    { name: `Live check ${suffix}` },
    sessionA.header(),
  );
  const subjectId = subject.payload?.subject?.id;
  if (subject.status !== 201 || typeof subjectId !== "string") {
    throw new Error(`could not create a subject (status=${subject.status})`);
  }

  // --- administrator options ---------------------------------------------
  const adminOptions = await appGetJson(
    "/api/staff/attendance/options",
    sessionA.header(),
  );
  const optionClasses = adminOptions.payload?.classes ?? [];
  report.check(
    adminOptions.status === 200 &&
      optionClasses.some((row) => row.id === otherClass),
    "an administrator's class picker includes every class in the school (200)",
    `status=${adminOptions.status} classes=${optionClasses.length}`,
  );

  // --- a teacher, invited and assigned ------------------------------------
  const teacherEmail = randomEmail("attendance.teacher");
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

  const members = await appGetJson("/api/staff/members", sessionA.header());
  const teacher = (members.payload?.members ?? []).find(
    (row) => row.email === teacherEmail,
  );
  if (!teacher) {
    throw new Error("the invited teacher is missing from the member list");
  }

  const assignment = await appPostJson(
    "/api/staff/assignments",
    {
      membershipId: teacher.membershipId,
      classId: assignedClass,
      subjectId,
    },
    sessionA.header(),
  );
  if (assignment.status !== 201) {
    throw new Error(
      `could not assign the teacher (status=${assignment.status})`,
    );
  }

  const sessionT = await signIn(teacherEmail, teacherPassword);

  const teacherOptions = await appGetJson(
    `/api/staff/attendance/options?classId=${assignedClass}`,
    sessionT.header(),
  );
  const teacherClasses = teacherOptions.payload?.classes ?? [];
  report.check(
    teacherOptions.status === 200 &&
      teacherClasses.length > 0 &&
      teacherClasses.every((row) => row.id === assignedClass),
    "a teacher sees only their assigned class in the picker (200)",
    `status=${teacherOptions.status} classes=${teacherClasses.length}`,
  );

  const teacherSubjects = teacherOptions.payload?.subjects ?? [];
  report.check(
    teacherSubjects.some((row) => row.id === subjectId),
    "a teacher sees their own subject in that class",
    `subjects=${teacherSubjects.length}`,
  );

  // The important half: not every subject in the school. The teacher holds no
  // subject.read, so the school-wide catalogue stays out of reach.
  const { count: schoolSubjectCount } = await admin
    .from("subjects")
    .select("id", { count: "exact", head: true })
    .eq("school_id", state.schools.A)
    .eq("is_active", true);
  report.check(
    typeof schoolSubjectCount === "number" &&
      teacherSubjects.length > 0 &&
      teacherSubjects.length < schoolSubjectCount,
    "a teacher does not get the whole subject catalogue",
    `teacher=${teacherSubjects.length} school=${schoolSubjectCount}`,
  );

  // --- opening a register -------------------------------------------------
  const blankName = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: "", sessionDate: todayIso },
    sessionA.header(),
  );
  report.check(
    blankName.status === 400,
    "a register with no class is refused (400)",
    `status=${blankName.status}`,
  );

  const future = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: assignedClass, sessionDate: "2099-01-01" },
    sessionA.header(),
  );
  report.check(
    future.status === 400,
    "a register for a future date is refused (400)",
    `status=${future.status}`,
  );

  const opened = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: assignedClass, subjectId, sessionDate: todayIso },
    sessionT.header(),
  );
  const sessionId = opened.payload?.session?.id;
  report.check(
    opened.status === 201 && typeof sessionId === "string",
    "a teacher opens a register for their own class (201)",
    `status=${opened.status}`,
  );

  if (typeof sessionId !== "string") {
    throw new Error("no register to continue with");
  }

  const duplicate = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: assignedClass, subjectId, sessionDate: todayIso },
    sessionT.header(),
  );
  report.check(
    duplicate.status === 409,
    "opening the same register twice is refused (409)",
    `status=${duplicate.status}`,
  );

  // --- the teacher class scope (the security point of this slice) --------
  const crossClass = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: otherClass, subjectId, sessionDate: todayIso },
    sessionT.header(),
  );
  report.check(
    crossClass.status === 404,
    "a teacher cannot open a register for a class they are not assigned to (404)",
    `status=${crossClass.status}`,
  );

  const crossSchool = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: bClassId, subjectId, sessionDate: todayIso },
    sessionT.header(),
  );
  report.check(
    crossSchool.status === 404 || crossSchool.status === 400,
    "another school's class is refused for a teacher",
    `status=${crossSchool.status}`,
  );

  // --- the register -------------------------------------------------------
  const register = await appGetJson(
    `/api/staff/attendance/register?sessionId=${sessionId}`,
    sessionT.header(),
  );
  const roster = register.payload?.detail?.roster ?? [];
  report.check(
    register.status === 200 && Array.isArray(roster),
    "a teacher reads the roster of their class (200)",
    `status=${register.status} learners=${roster.length}`,
  );

  const crossRegister = await appGetJson(
    `/api/staff/attendance/register?sessionId=${sessionId}`,
    sessionB.header(),
  );
  report.check(
    crossRegister.status === 404,
    "another school's administrator cannot read this register (404)",
    `status=${crossRegister.status}`,
  );

  const marked = await appPostJson(
    "/api/staff/attendance/register",
    {
      sessionId,
      entries: roster.map((learner, index) => ({
        learnerId: learner.learnerId,
        status: index === 0 ? "absent" : index === 1 ? "late" : "present",
      })),
    },
    sessionT.header(),
  );
  const markedRoster = marked.payload?.detail?.roster ?? [];
  report.check(
    marked.status === 200 &&
      markedRoster.length === roster.length &&
      markedRoster.every((learner) => learner.status !== null),
    "a teacher saves the whole register (200)",
    `status=${marked.status} marked=${markedRoster.filter((l) => l.status).length}`,
  );

  const unknownStatus = await appPostJson(
    "/api/staff/attendance/register",
    {
      sessionId,
      entries: [{ learnerId: roster[0]?.learnerId, status: "unwell" }],
    },
    sessionT.header(),
  );
  report.check(
    unknownStatus.status === 400,
    "an unknown attendance status is refused (400)",
    `status=${unknownStatus.status}`,
  );

  const duplicateLearner = await appPostJson(
    "/api/staff/attendance/register",
    {
      sessionId,
      entries: [
        { learnerId: roster[0]?.learnerId, status: "present" },
        { learnerId: roster[0]?.learnerId, status: "absent" },
      ],
    },
    sessionT.header(),
  );
  report.check(
    duplicateLearner.status === 400,
    "the same learner twice in one submission is refused (400)",
    `status=${duplicateLearner.status}`,
  );

  const unknownLearner = await appPostJson(
    "/api/staff/attendance/register",
    {
      sessionId,
      entries: [
        {
          learnerId: "00000000-0000-4000-8000-0000000000ff",
          status: "present",
        },
      ],
    },
    sessionT.header(),
  );
  report.check(
    unknownLearner.status === 400,
    "a learner who is not in the class cannot be marked (400)",
    `status=${unknownLearner.status}`,
  );

  // --- the correction window, on a date this run owns --------------------
  let freeDate = null;
  for (let back = 1; back <= 400 && freeDate === null; back += 1) {
    const candidate = dateDaysAgo(back);
    const probe = await appGetJson(
      `/api/staff/attendance/sessions?date=${candidate}&classId=${assignedClass}`,
      sessionA.header(),
    );
    if (probe.status === 200 && (probe.payload?.sessions ?? []).length === 0) {
      freeDate = candidate;
    }
  }
  if (freeDate === null) {
    throw new Error("no free past date for the correction-window checks");
  }

  const past = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: assignedClass, subjectId, sessionDate: freeDate },
    sessionT.header(),
  );
  const pastId = past.payload?.session?.id;
  report.check(
    past.status === 201 && typeof pastId === "string",
    "a teacher opens a register for a past date (201)",
    `status=${past.status} date=${freeDate}`,
  );

  if (typeof pastId === "string") {
    const teacherPastWrite = await appPostJson(
      "/api/staff/attendance/register",
      {
        sessionId: pastId,
        entries: roster.map((learner) => ({
          learnerId: learner.learnerId,
          status: "present",
        })),
      },
      sessionT.header(),
    );
    report.check(
      teacherPastWrite.status === 409,
      "a teacher cannot correct a register older than today (409)",
      `status=${teacherPastWrite.status}`,
    );

    const teacherPastRead = await appGetJson(
      `/api/staff/attendance/register?sessionId=${pastId}`,
      sessionT.header(),
    );
    report.check(
      teacherPastRead.status === 200 &&
        teacherPastRead.payload?.detail?.session?.isCorrectable === false,
      "the register is shown to a teacher but marked not correctable",
      `status=${teacherPastRead.status}`,
    );

    // The administrator marks a deliberate pattern, which the report then reads
    // back exactly, because this date has no other register on it.
    const adminPastWrite = await appPostJson(
      "/api/staff/attendance/register",
      {
        sessionId: pastId,
        entries: roster.map((learner, index) => ({
          learnerId: learner.learnerId,
          status: index === 0 ? "excused" : index === 1 ? "late" : "present",
        })),
      },
      sessionA.header(),
    );
    report.check(
      adminPastWrite.status === 200,
      "an administrator can correct a past register (200)",
      `status=${adminPastWrite.status}`,
    );
  }

  // --- the report ---------------------------------------------------------
  const teacherReport = await appGetJson(
    `/api/staff/attendance/report?classId=${assignedClass}&from=${freeDate}&to=${freeDate}`,
    sessionT.header(),
  );
  report.check(
    teacherReport.status === 403,
    "a teacher is refused the class report (403)",
    `status=${teacherReport.status}`,
  );

  const adminReport = await appGetJson(
    `/api/staff/attendance/report?classId=${assignedClass}&from=${freeDate}&to=${freeDate}`,
    sessionA.header(),
  );
  const result = adminReport.payload?.report;
  const totalFor = (status) =>
    result?.totals?.find((row) => row.status === status)?.count ?? -1;

  report.check(
    adminReport.status === 200 &&
      result?.classId === assignedClass &&
      result?.sessionCount === 1,
    "an administrator builds the class report for one date (200)",
    `status=${adminReport.status} sessions=${result?.sessionCount}`,
  );
  report.check(
    totalFor("excused") === 1 &&
      totalFor("late") === 1 &&
      totalFor("present") === roster.length - 2 &&
      totalFor("absent") === 0,
    "the report totals match what was recorded",
    `excused=${totalFor("excused")} late=${totalFor("late")} present=${totalFor("present")} absent=${totalFor("absent")}`,
  );
  report.check(
    result?.learners?.find(
      (learner) => learner.learnerId === roster[0]?.learnerId,
    )?.excused === 1,
    "the report breaks the counts down per learner",
  );

  const crossReport = await appGetJson(
    "/api/staff/attendance/report?classId=" + bClassId,
    sessionA.header(),
  );
  report.check(
    crossReport.status === 404,
    "a report for another school's class is a 404",
    `status=${crossReport.status}`,
  );

  const noClass = await appGetJson(
    "/api/staff/attendance/report",
    sessionA.header(),
  );
  report.check(
    noClass.status === 400,
    "a report with no class is refused (400)",
    `status=${noClass.status}`,
  );

  const tooWide = await appGetJson(
    `/api/staff/attendance/report?classId=${assignedClass}&from=2015-01-01&to=${todayIso}`,
    sessionA.header(),
  );
  report.check(
    tooWide.status === 400,
    "an unbounded report window is refused (400)",
    `status=${tooWide.status}`,
  );

  // --- a teacher assigned to no class can reach no register ---------------
  const plainEmail = randomEmail("attendance.plain");
  const plainPassword = randomPassword();
  const plainInvited = await appPostJson(
    "/api/staff/invite",
    { email: plainEmail, role: "teacher" },
    sessionA.header(),
  );
  if (plainInvited.status !== 201) {
    throw new Error("could not invite a second teacher");
  }
  await appPostJson("/api/staff/invitations/accept", {
    token: tokenFromLink(plainInvited.payload.activationLink),
    password: plainPassword,
  });
  const sessionP = await signIn(plainEmail, plainPassword);

  const emptyOptions = await appGetJson(
    "/api/staff/attendance/options",
    sessionP.header(),
  );
  report.check(
    emptyOptions.status === 200 &&
      (emptyOptions.payload?.classes ?? []).length === 0,
    "a teacher assigned to no class sees an empty picker (200)",
    `status=${emptyOptions.status} classes=${(emptyOptions.payload?.classes ?? []).length}`,
  );

  const deniedOpen = await appPostJson(
    "/api/staff/attendance/sessions",
    { classId: assignedClass, subjectId, sessionDate: todayIso },
    sessionP.header(),
  );
  report.check(
    deniedOpen.status === 404,
    "a teacher assigned to no class cannot open anyone's register (404)",
    `status=${deniedOpen.status}`,
  );

  const deniedRead = await appGetJson(
    `/api/staff/attendance/register?sessionId=${sessionId}`,
    sessionP.header(),
  );
  report.check(
    deniedRead.status === 404,
    "the same teacher cannot read an existing register (404)",
    `status=${deniedRead.status}`,
  );

  const deniedReport = await appGetJson(
    `/api/staff/attendance/report?classId=${assignedClass}`,
    sessionP.header(),
  );
  report.check(
    deniedReport.status === 403,
    "the same teacher is refused the class report (403)",
    `status=${deniedReport.status}`,
  );

  // --- the audit trail records who marked what ---------------------------
  const { data: recordIds } = await admin
    .from("attendance_records")
    .select("id")
    .eq("session_id", sessionId);
  const { data: auditRows } = await admin
    .from("audit_events")
    .select("action, actor_user_id")
    .eq("target_table", "attendance_records")
    .eq("target_id", recordIds?.[0]?.id ?? "")
    .order("id");

  report.check(
    (auditRows ?? []).some((row) => row.action === "insert"),
    "recording an attendance mark is audited",
    `events=${auditRows?.length}`,
  );

  const { data: teacherRow } = await admin
    .from("school_members")
    .select("user_id")
    .eq("id", teacher.membershipId)
    .maybeSingle();
  report.check(
    auditRows?.some((row) => row.actor_user_id === teacherRow?.user_id) ===
      true,
    "the audit event names the teacher who marked the register",
  );

  const { data: sessionAudit } = await admin
    .from("audit_events")
    .select("action")
    .eq("target_table", "attendance_sessions")
    .eq("target_id", sessionId);
  report.check(
    (sessionAudit ?? []).some((row) => row.action === "insert"),
    "opening a register is audited too",
    `events=${sessionAudit?.length}`,
  );

  if (typeof pastId === "string") {
    // The teacher's write to the past register was refused, so the
    // administrator's mark is its first entry, not a correction.
    const { data: pastRecordIds } = await admin
      .from("attendance_records")
      .select("id")
      .eq("session_id", pastId);
    const { data: pastAudit } = await admin
      .from("audit_events")
      .select("action")
      .eq("target_table", "attendance_records")
      .eq("target_id", pastRecordIds?.[0]?.id ?? "");
    report.check(
      (pastAudit ?? []).length === 1 && pastAudit?.[0]?.action === "insert",
      "a register the teacher could not touch holds only the administrator's entry",
      `events=${pastAudit?.length}`,
    );
  }

  // A correction on a register that already has marks is an update, and is
  // audited as one rather than overwriting silently.
  const corrected = await appPostJson(
    "/api/staff/attendance/register",
    {
      sessionId,
      entries: roster.map((learner, index) => ({
        learnerId: learner.learnerId,
        status: index === 0 ? "excused" : index === 1 ? "late" : "present",
      })),
    },
    sessionA.header(),
  );
  report.check(
    corrected.status === 200,
    "an administrator corrects today's register (200)",
    `status=${corrected.status}`,
  );

  const { data: correctedAudit } = await admin
    .from("audit_events")
    .select("action, actor_user_id")
    .eq("target_table", "attendance_records")
    .eq("target_id", recordIds?.[0]?.id ?? "")
    .order("id");
  report.check(
    (correctedAudit ?? []).some((row) => row.action === "insert") &&
      (correctedAudit ?? []).some((row) => row.action === "update"),
    "a correction is audited as an update, not a silent overwrite",
    `events=${correctedAudit?.length}`,
  );
  report.check(
    (correctedAudit ?? []).some((row) => row.actor_user_id === adminA.userId),
    "the correction is attributed to the administrator",
  );

  // Attendance is never deleted: the register is still on record.
  report.check(
    Array.isArray(recordIds) && recordIds.length === roster.length,
    "the register is still on record after being saved",
    `records=${recordIds?.length}`,
  );

  const sessions = await appGetJson(
    `/api/staff/attendance/sessions?date=${todayIso}`,
    sessionT.header(),
  );
  report.check(
    sessions.status === 200 &&
      (sessions.payload?.sessions ?? []).every(
        (row) => row.classId === assignedClass,
      ),
    "a teacher lists registers only for their own class (200)",
    `status=${sessions.status}`,
  );
}

try {
  await main();
  process.exitCode = report.summary() ? 0 : 1;
} catch (error) {
  console.error("attendance: unexpected failure");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
