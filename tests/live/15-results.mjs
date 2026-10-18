// Live check 15: assessments, results and school-defined grading (D-031).
//
// Covers, through the running app and the real database:
//   * GET/POST /api/staff/grade-bands          — the school's own scale
//   * POST      /api/staff/grade-bands/update   — relabel, re-mark, remove
//   * GET/POST /api/staff/assessments          — list / set up an assessment
//   * POST      /api/staff/assessments/update  — rename, re-date, retire
//   * GET/POST /api/staff/results               — read / write a result sheet
//   * GET       /api/staff/reports/academic     — the administrator's summary
//
// including the teacher class scope, the score ceiling, the whole-sheet rule,
// the band-overlap refusal, cross-school denial, auditing, and the two properties
// that matter most here: a teacher cannot configure the school's grading scale,
// and no universal grading rule is applied anywhere.
//
// Requires migration 20261018000009_phase4_assessments. `run-all.mjs` skips this
// step when that migration has not been applied to the environment under test.
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

const report = createReporter("results");

function randomEmail(prefix) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@exampleschool.example`;
}

function tokenFromLink(link) {
  return new URL(link).hash.replace(/^#token=/, "");
}

async function signIn(email, password) {
  const res = await appPostJson("/api/staff/sign-in", { email, password });
  if (res.status !== 200 || res.payload?.ok !== true) {
    throw new Error(`sign-in failed for ${email} (status=${res.status})`);
  }
  const jar = createCookieJar();
  jar.applySetCookie(res.setCookie);
  return jar;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** A past date with no assessment on it, so report totals stay exact. */
async function freeAssessmentDate(session, classId, admin) {
  for (let back = 1; back <= 400; back += 1) {
    const candidate = new Date(Date.now() - back * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data } = await admin
      .from("assessments")
      .select("id")
      .eq("class_id", classId)
      .eq("assessed_on", candidate)
      .limit(1);
    if ((data ?? []).length === 0) {
      const probe = await appGetJson(
        `/api/staff/assessments?classId=${classId}`,
        session.header(),
      );
      if (probe.status === 200) {
        return candidate;
      }
    }
  }
  return null;
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
  const todayIso = today();
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();

  const { data: aClasses } = await admin
    .from("classes")
    .select("id")
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

  // --- the page and the APIs refuse an anonymous caller --------------------
  const page = await appGetRaw("/dashboard/results");
  report.check(
    page.status === 200 &&
      page.body.includes("/sign-in") &&
      page.body.includes('http-equiv="refresh"'),
    "/dashboard/results streams a redirect to /sign-in for an anonymous visitor",
    `status=${page.status}`,
  );

  for (const path of [
    "/api/staff/assessments",
    "/api/staff/grade-bands",
    "/api/staff/results?assessmentId=00000000-0000-4000-8000-000000000000",
    "/api/staff/reports/academic?classId=00000000-0000-4000-8000-000000000000",
  ]) {
    const res = await appGetJson(path);
    report.check(
      res.status === 401,
      `an anonymous GET of ${path} is refused (401)`,
      `status=${res.status}`,
    );
  }
  for (const path of [
    "/api/staff/assessments",
    "/api/staff/grade-bands",
    "/api/staff/results",
  ]) {
    const res = await appPostJson(path, {}, undefined);
    report.check(
      res.status === 401,
      `an anonymous POST to ${path} is refused (401)`,
      `status=${res.status}`,
    );
  }

  // --- grade bands: the school's own scale --------------------------------
  const emptyBands = await appGetJson(
    "/api/staff/grade-bands",
    sessionA.header(),
  );
  report.check(
    emptyBands.status === 200 && Array.isArray(emptyBands.payload?.bands),
    "an administrator lists the grading bands (200); an empty list is valid",
    `status=${emptyBands.status} bands=${(emptyBands.payload?.bands ?? []).length}`,
  );

  const badBand = await appPostJson(
    "/api/staff/grade-bands",
    { minPercentage: 140, label: "A+", isPassing: true },
    sessionA.header(),
  );
  report.check(
    badBand.status === 400,
    "a band outside 0-100 is refused (400)",
    `status=${badBand.status}`,
  );

  // Two bands this run owns, at bounds nothing else uses.
  const firstMin = 61 + (Number.parseInt(suffix.slice(0, 2), 16) % 20);
  const secondMin = firstMin + 20;
  const lowBand = await appPostJson(
    "/api/staff/grade-bands",
    { minPercentage: firstMin, label: `X${suffix}`, isPassing: true },
    sessionA.header(),
  );
  report.check(
    lowBand.status === 201,
    "an administrator adds the lower band of a scale (201)",
    `status=${lowBand.status} min=${firstMin}`,
  );

  const highBand = await appPostJson(
    "/api/staff/grade-bands",
    { minPercentage: secondMin, label: `Y${suffix}`, isPassing: true },
    sessionA.header(),
  );
  report.check(
    highBand.status === 201,
    "an administrator adds a band above it (201)",
    `status=${highBand.status} min=${secondMin}`,
  );

  const overlap = await appPostJson(
    "/api/staff/grade-bands",
    {
      minPercentage: firstMin + 10,
      label: `Z${suffix}`,
      isPassing: true,
    },
    sessionA.header(),
  );
  report.check(
    overlap.status === 409,
    "a band that would split an existing range is refused (409)",
    `status=${overlap.status}`,
  );

  const duplicateBand = await appPostJson(
    "/api/staff/grade-bands",
    { minPercentage: firstMin, label: `W${suffix}`, isPassing: true },
    sessionA.header(),
  );
  report.check(
    duplicateBand.status === 409,
    "a duplicate band bound is refused (409)",
    `status=${duplicateBand.status}`,
  );

  const bandId = highBand.payload?.band?.id;
  const reMarked = await appPostJson(
    "/api/staff/grade-bands/update",
    { bandId, isPassing: false },
    sessionA.header(),
  );
  report.check(
    reMarked.status === 200 && reMarked.payload?.band?.isPassing === false,
    "an administrator changes whether a band counts as passing (200)",
    `status=${reMarked.status}`,
  );

  // --- a teacher, invited and assigned -------------------------------------
  const teacherEmail = randomEmail("results.teacher");
  const teacherPassword = randomPassword();
  const invited = await appPostJson(
    "/api/staff/invite",
    { email: teacherEmail, role: "teacher" },
    sessionA.header(),
  );
  if (invited.status !== 201 || !invited.payload?.activationLink) {
    throw new Error(`could not invite a teacher (status=${invited.status})`);
  }
  await appPostJson("/api/staff/invitations/accept", {
    token: tokenFromLink(invited.payload.activationLink),
    password: teacherPassword,
  });

  const members = await appGetJson("/api/staff/members", sessionA.header());
  const teacher = (members.payload?.members ?? []).find(
    (row) => row.email === teacherEmail,
  );
  if (!teacher) {
    throw new Error("the invited teacher is missing from the member list");
  }

  const assignment = await appPostJson(
    "/api/staff/assignments",
    { membershipId: teacher.membershipId, classId: assignedClass },
    sessionA.header(),
  );
  if (assignment.status !== 201) {
    throw new Error(
      `could not assign the teacher (status=${assignment.status})`,
    );
  }

  const sessionT = await signIn(teacherEmail, teacherPassword);

  // A teacher may read the scale but not change it.
  const teacherBands = await appGetJson(
    "/api/staff/grade-bands",
    sessionT.header(),
  );
  report.check(
    teacherBands.status === 200 &&
      (teacherBands.payload?.bands ?? []).some(
        (band) => band.label === `Y${suffix}`,
      ),
    "a teacher can read the grading scale they mark against (200)",
    `status=${teacherBands.status}`,
  );

  const teacherWritesBand = await appPostJson(
    "/api/staff/grade-bands",
    { minPercentage: 5, label: `T${suffix}`, isPassing: true },
    sessionT.header(),
  );
  report.check(
    teacherWritesBand.status === 403,
    "a teacher cannot change the school's grading scale (403)",
    `status=${teacherWritesBand.status}`,
  );

  const teacherDeletesBand = await appPostJson(
    "/api/staff/grade-bands/update",
    { bandId, action: "delete" },
    sessionT.header(),
  );
  report.check(
    teacherDeletesBand.status === 403,
    "a teacher cannot remove a band either (403)",
    `status=${teacherDeletesBand.status}`,
  );

  // --- assessments --------------------------------------------------------
  const noClass = await appPostJson(
    "/api/staff/assessments",
    { name: "x", maxScore: 10, assessedOn: todayIso },
    sessionA.header(),
  );
  report.check(
    noClass.status === 400,
    "an assessment with no class is refused (400)",
    `status=${noClass.status}`,
  );

  const future = await appPostJson(
    "/api/staff/assessments",
    {
      classId: assignedClass,
      name: "x",
      maxScore: 10,
      assessedOn: "2099-01-01",
    },
    sessionA.header(),
  );
  report.check(
    future.status === 400,
    "an assessment dated in the future is refused (400)",
    `status=${future.status}`,
  );

  const assessmentDate = await freeAssessmentDate(
    sessionA,
    assignedClass,
    admin,
  );
  if (assessmentDate === null) {
    throw new Error("no free date for the assessment checks");
  }

  const created = await appPostJson(
    "/api/staff/assessments",
    {
      classId: assignedClass,
      name: `Live check ${suffix}`,
      maxScore: 40,
      assessedOn: assessmentDate,
    },
    sessionT.header(),
  );
  const assessmentId = created.payload?.assessment?.id;
  report.check(
    created.status === 201 && typeof assessmentId === "string",
    "a teacher sets up an assessment for their own class (201)",
    `status=${created.status}`,
  );
  if (typeof assessmentId !== "string") {
    throw new Error("no assessment to continue with");
  }

  const crossClass = await appPostJson(
    "/api/staff/assessments",
    {
      classId: otherClass,
      name: "Not mine",
      maxScore: 10,
      assessedOn: assessmentDate,
    },
    sessionT.header(),
  );
  report.check(
    crossClass.status === 404,
    "a teacher cannot set up an assessment for an unassigned class (404)",
    `status=${crossClass.status}`,
  );

  const crossSchool = await appPostJson(
    "/api/staff/assessments",
    {
      classId: bClassId,
      name: "Other school",
      maxScore: 10,
      assessedOn: assessmentDate,
    },
    sessionT.header(),
  );
  report.check(
    crossSchool.status === 404 || crossSchool.status === 400,
    "another school's class is refused for an assessment",
    `status=${crossSchool.status}`,
  );

  const bSessionList = await appGetJson(
    `/api/staff/assessments?classId=${assignedClass}`,
    sessionB.header(),
  );
  report.check(
    bSessionList.status === 200 &&
      (bSessionList.payload?.assessments ?? []).length === 0,
    "another school's administrator sees none of this school's assessments (200)",
    `status=${bSessionList.status}`,
  );

  // --- marks --------------------------------------------------------------
  const sheet = await appGetJson(
    `/api/staff/results?assessmentId=${assessmentId}`,
    sessionT.header(),
  );
  const entries = sheet.payload?.sheet?.entries ?? [];
  report.check(
    sheet.status === 200 && Array.isArray(entries),
    "a teacher reads the result sheet for their class (200)",
    `status=${sheet.status} learners=${entries.length}`,
  );

  const crossSheet = await appGetJson(
    `/api/staff/results?assessmentId=${assessmentId}`,
    sessionB.header(),
  );
  report.check(
    crossSheet.status === 404,
    "another school's administrator cannot read the sheet (404)",
    `status=${crossSheet.status}`,
  );

  const tooHigh = await appPostJson(
    "/api/staff/results",
    {
      assessmentId,
      entries: [{ learnerId: entries[0]?.learnerId, score: 41 }],
    },
    sessionT.header(),
  );
  report.check(
    tooHigh.status === 400,
    "a score above the assessment maximum is refused (400)",
    `status=${tooHigh.status}`,
  );

  const badStatus = await appPostJson(
    "/api/staff/results",
    { assessmentId, entries: [{ learnerId: entries[0]?.learnerId }] },
    sessionT.header(),
  );
  report.check(
    // An absent score is valid (unmarked), so this check proves a *repeated*
    // learner is refused instead, which is a real validation path.
    badStatus.status === 400,
    "the same learner twice in one submission is refused (400)",
    `status=${badStatus.status}`,
  );

  const duplicateLearner = await appPostJson(
    "/api/staff/results",
    {
      assessmentId,
      entries: [
        { learnerId: entries[0]?.learnerId, score: 10 },
        { learnerId: entries[0]?.learnerId, score: 20 },
      ],
    },
    sessionT.header(),
  );
  report.check(
    duplicateLearner.status === 400,
    "a repeated learner in the sheet is refused (400)",
    `status=${duplicateLearner.status}`,
  );

  const unknownLearner = await appPostJson(
    "/api/staff/results",
    {
      assessmentId,
      entries: [
        {
          learnerId: "00000000-0000-4000-8000-0000000000ee",
          score: 10,
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

  // Mark deliberately: 40 is the maximum, so index-based scores land either in
  // the band above or below the two thresholds this run added.
  const marks = entries.map((entry, index) => ({
    learnerId: entry.learnerId,
    score: index === 0 ? 40 : index === 1 ? 0 : 20,
  }));

  const saved = await appPostJson(
    "/api/staff/results",
    { assessmentId, entries: marks },
    sessionT.header(),
  );
  const savedEntries = saved.payload?.sheet?.entries ?? [];
  report.check(
    saved.status === 200 &&
      savedEntries.length === entries.length &&
      savedEntries.every((entry) => entry.score !== null),
    "a teacher records the whole sheet (200)",
    `status=${saved.status}`,
  );

  const top = savedEntries[0];
  report.check(
    top?.percentage === 100 && top?.grade?.label === `X${suffix}`,
    "a full mark is 100% and lands in the lower band added this run",
    `percentage=${top?.percentage} grade=${top?.grade?.label}`,
  );

  const bottom = savedEntries[1];
  report.check(
    bottom?.percentage === 0 && bottom?.grade === null,
    "a zero mark has no band, so no grade is invented for it",
    `percentage=${bottom?.percentage} grade=${bottom?.grade?.label}`,
  );

  // --- the academic report ------------------------------------------------
  const teacherReport = await appGetJson(
    `/api/staff/reports/academic?classId=${assignedClass}`,
    sessionT.header(),
  );
  report.check(
    teacherReport.status === 403,
    "a teacher is refused the whole-class summary (403)",
    `status=${teacherReport.status}`,
  );

  const report1 = (
    await appGetJson(
      `/api/staff/reports/academic?classId=${assignedClass}&from=${assessmentDate}&to=${assessmentDate}`,
      sessionA.header(),
    )
  ).payload?.report;
  report.check(
    report1 !== undefined && report1.assessments?.length === 1,
    "an administrator builds the class summary (200)",
    `assessments=${report1?.assessments?.length}`,
  );
  report.check(
    report1?.assessments?.[0]?.markedCount === entries.length,
    "the summary counts every mark recorded",
    `marked=${report1?.assessments?.[0]?.markedCount}`,
  );
  report.check(
    report1?.gradingIsConfigured === true,
    "the summary reports that a grading scale is configured",
  );

  const crossReport = await appGetJson(
    `/api/staff/reports/academic?classId=${bClassId}`,
    sessionA.header(),
  );
  report.check(
    crossReport.status === 404,
    "a summary for another school's class is a 404",
    `status=${crossReport.status}`,
  );

  const noClassReport = await appGetJson(
    "/api/staff/reports/academic",
    sessionA.header(),
  );
  report.check(
    noClassReport.status === 400,
    "a summary with no class is refused (400)",
    `status=${noClassReport.status}`,
  );

  // --- retiring an assessment keeps its marks -----------------------------
  const retired = await appPostJson(
    "/api/staff/assessments/update",
    { assessmentId, isActive: false },
    sessionA.header(),
  );
  report.check(
    retired.status === 200 && retired.payload?.assessment?.isActive === false,
    "an assessment is retired rather than deleted (200)",
    `status=${retired.status}`,
  );

  const writeAfterRetire = await appPostJson(
    "/api/staff/results",
    { assessmentId, entries: marks },
    sessionT.header(),
  );
  report.check(
    writeAfterRetire.status === 400,
    "a retired assessment refuses new marks (400)",
    `status=${writeAfterRetire.status}`,
  );

  const { data: keptResults } = await admin
    .from("assessment_results")
    .select("id")
    .eq("assessment_id", assessmentId);
  report.check(
    Array.isArray(keptResults) && keptResults.length === entries.length,
    "retiring an assessment keeps every mark already recorded",
    `results=${keptResults?.length}`,
  );

  // --- auditing ------------------------------------------------------------
  const { data: auditRows } = await admin
    .from("audit_events")
    .select("action, actor_user_id")
    .eq("target_table", "assessment_results")
    .eq("target_id", keptResults?.[0]?.id ?? "")
    .order("id");
  report.check(
    (auditRows ?? []).some((row) => row.action === "insert"),
    "recording a mark is audited",
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
    "the audit event names the teacher who marked the work",
  );

  // --- a teacher assigned to no class reaches nothing ----------------------
  const plainEmail = randomEmail("results.plain");
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

  const deniedList = await appGetJson(
    "/api/staff/assessments",
    sessionP.header(),
  );
  report.check(
    deniedList.status === 200 &&
      (deniedList.payload?.assessments ?? []).length === 0,
    "a teacher assigned to no class sees no assessments (200)",
    `status=${deniedList.status}`,
  );

  const deniedSheet = await appGetJson(
    `/api/staff/results?assessmentId=${assessmentId}`,
    sessionP.header(),
  );
  report.check(
    deniedSheet.status === 404,
    "the same teacher cannot read an existing sheet (404)",
    `status=${deniedSheet.status}`,
  );

  const deniedReport = await appGetJson(
    `/api/staff/reports/academic?classId=${assignedClass}`,
    sessionP.header(),
  );
  report.check(
    deniedReport.status === 403,
    "the same teacher is refused the class summary (403)",
    `status=${deniedReport.status}`,
  );
}

try {
  await main();
  process.exitCode = report.summary() ? 0 : 1;
} catch (error) {
  console.error("results: unexpected failure");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
