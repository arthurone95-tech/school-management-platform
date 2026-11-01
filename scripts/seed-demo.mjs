// One-off demo seed: creates "Greenwood Academy" with sample staff, classes,
// learners, attendance and assessment data for pitches and live demos.
//
// Usage: npm run seed:demo
// Safe to re-run: an existing Greenwood Academy (code GRNWD) is removed first.

import { loadEnvLocal } from "../tests/live/env.mjs";
import { createClient } from "@supabase/supabase-js";

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  throw new Error(
    ".env.local is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY",
  );
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SCHOOL_CODE = "GRNWD";
const SCHOOL_NAME = "Greenwood Academy";
const ADMIN_EMAIL = "admin@greenwood.edu";
const TEACHER1_EMAIL = "teacher1@greenwood.edu";
const TEACHER2_EMAIL = "teacher2@greenwood.edu";
const ADMIN_PASSWORD = "DemoAdmin#2026";
const TEACHER_PASSWORD = "DemoTeacher#2026";

const DEFAULT_BANDS = [
  { min_percentage: 0, label: "F", remark: "Fail", is_passing: false },
  { min_percentage: 40, label: "D", remark: "Pass", is_passing: true },
  { min_percentage: 50, label: "C", remark: "Credit", is_passing: true },
  { min_percentage: 60, label: "B", remark: "Good", is_passing: true },
  { min_percentage: 70, label: "A", remark: "Very Good", is_passing: true },
  { min_percentage: 80, label: "A+", remark: "Excellent", is_passing: true },
];

async function cleanupExisting() {
  const { data: school } = await admin
    .from("schools")
    .select("id")
    .eq("code", SCHOOL_CODE)
    .maybeSingle();
  if (!school) return;

  const schoolId = school.id;
  const { data: members } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId);
  const userIds = (members ?? []).map((m) => m.user_id);

  // FK-safe order. assessment_results has no DELETE grant for any role, so it is
  // removed by cascading from assessments (which does grant DELETE to service_role).
  await admin.from("assessments").delete().eq("school_id", schoolId);
  await admin.from("attendance_records").delete().eq("school_id", schoolId);
  await admin.from("attendance_sessions").delete().eq("school_id", schoolId);
  await admin.from("grade_bands").delete().eq("school_id", schoolId);
  await admin.from("staff_assignments").delete().eq("school_id", schoolId);
  await admin
    .from("learner_class_placements")
    .delete()
    .eq("school_id", schoolId);
  await admin.from("learners").delete().eq("school_id", schoolId);
  await admin.from("classes").delete().eq("school_id", schoolId);
  await admin.from("subjects").delete().eq("school_id", schoolId);
  await admin.from("staff_invitations").delete().eq("school_id", schoolId);
  await admin.from("audit_events").delete().eq("school_id", schoolId);
  await admin.from("school_members").delete().eq("school_id", schoolId);
  const { error: schoolDeleteError } = await admin
    .from("schools")
    .delete()
    .eq("id", schoolId);
  if (schoolDeleteError)
    throw new Error(`School cleanup failed: ${schoolDeleteError.message}`);

  for (const userId of userIds) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // Best effort; ignore.
    }
  }
}

async function createAuthUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provisioned_by: "school-platform" },
  });
  if (error || !data.user) {
    throw new Error(
      `Auth user creation failed for ${email}: ${error?.message ?? "unknown"}`,
    );
  }
  return data.user.id;
}

async function main() {
  console.log("Cleaning up any existing Greenwood Academy seed...");
  await cleanupExisting();

  console.log("Creating school...");
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ name: SCHOOL_NAME, code: SCHOOL_CODE })
    .select("id, name, code")
    .single();
  if (schoolError || !school) {
    throw new Error(
      `School creation failed: ${schoolError?.message ?? "unknown"}`,
    );
  }
  const schoolId = school.id;

  console.log("Creating administrator account...");
  const adminUserId = await createAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  const { error: adminMembershipError } = await admin
    .from("school_members")
    .insert({
      school_id: schoolId,
      user_id: adminUserId,
      role: "school_administrator",
      status: "active",
    });
  if (adminMembershipError)
    throw new Error(`Admin membership failed: ${adminMembershipError.message}`);

  console.log("Creating teacher accounts...");
  const teacher1UserId = await createAuthUser(TEACHER1_EMAIL, TEACHER_PASSWORD);
  const teacher2UserId = await createAuthUser(TEACHER2_EMAIL, TEACHER_PASSWORD);
  const { data: t1Membership, error: t1Err } = await admin
    .from("school_members")
    .insert({
      school_id: schoolId,
      user_id: teacher1UserId,
      role: "teacher",
      status: "active",
    })
    .select("id")
    .single();
  if (t1Err) throw new Error(`Teacher1 membership failed: ${t1Err.message}`);
  const { data: t2Membership, error: t2Err } = await admin
    .from("school_members")
    .insert({
      school_id: schoolId,
      user_id: teacher2UserId,
      role: "teacher",
      status: "active",
    })
    .select("id")
    .single();
  if (t2Err) throw new Error(`Teacher2 membership failed: ${t2Err.message}`);

  console.log("Seeding grade bands...");
  const { error: bandsError } = await admin.from("grade_bands").insert(
    DEFAULT_BANDS.map((b) => ({
      school_id: schoolId,
      min_percentage: b.min_percentage,
      label: b.label,
      remark: b.remark,
      is_passing: b.is_passing,
    })),
  );
  if (bandsError) throw new Error(`Grade bands failed: ${bandsError.message}`);

  console.log("Creating subjects...");
  const { data: mathSubject, error: mathSubErr } = await admin
    .from("subjects")
    .insert({ school_id: schoolId, name: "Mathematics", code: "MATH" })
    .select("id")
    .single();
  if (mathSubErr) throw new Error(`Math subject failed: ${mathSubErr.message}`);
  const { data: engSubject, error: engSubErr } = await admin
    .from("subjects")
    .insert({ school_id: schoolId, name: "English", code: "ENG" })
    .select("id")
    .single();
  if (engSubErr)
    throw new Error(`English subject failed: ${engSubErr.message}`);

  console.log("Creating classes...");
  const { data: mathClass, error: mathClassErr } = await admin
    .from("classes")
    .insert({ school_id: schoolId, name: "Grade 9 Mathematics" })
    .select("id")
    .single();
  if (mathClassErr)
    throw new Error(`Math class failed: ${mathClassErr.message}`);
  const { data: engClass, error: engClassErr } = await admin
    .from("classes")
    .insert({ school_id: schoolId, name: "Grade 10 English" })
    .select("id")
    .single();
  if (engClassErr)
    throw new Error(`English class failed: ${engClassErr.message}`);

  console.log("Assigning teachers...");
  const { error: a1Err } = await admin.from("staff_assignments").insert({
    school_id: schoolId,
    membership_id: t1Membership.id,
    class_id: mathClass.id,
    subject_id: mathSubject.id,
  });
  if (a1Err) throw new Error(`Teacher1 assignment failed: ${a1Err.message}`);
  const { error: a2Err } = await admin.from("staff_assignments").insert({
    school_id: schoolId,
    membership_id: t2Membership.id,
    class_id: engClass.id,
    subject_id: engSubject.id,
  });
  if (a2Err) throw new Error(`Teacher2 assignment failed: ${a2Err.message}`);

  console.log("Creating learners...");
  const learners = [
    {
      username: "ama.mensah",
      registration_number: "GRN001",
      first_name: "Ama",
      last_name: "Mensah",
      gender: "female",
      date_of_birth: "2010-05-12",
      residential_address: "12 Accra Road, Accra",
      guardian_phone: "+233200000001",
      classId: mathClass.id,
    },
    {
      username: "kofi.boateng",
      registration_number: "GRN002",
      first_name: "Kofi",
      last_name: "Boateng",
      gender: "male",
      date_of_birth: "2009-11-03",
      residential_address: "5 Kumasi Street, Kumasi",
      guardian_phone: "+233200000002",
      classId: mathClass.id,
    },
    {
      username: "abena.owusu",
      registration_number: "GRN003",
      first_name: "Abena",
      last_name: "Owusu",
      gender: "female",
      date_of_birth: "2010-02-20",
      residential_address: "8 Tamale Lane, Tamale",
      guardian_phone: "+233200000003",
      classId: mathClass.id,
    },
    {
      username: "kwame.asante",
      registration_number: "GRN004",
      first_name: "Kwame",
      last_name: "Asante",
      gender: "male",
      date_of_birth: "2009-07-15",
      residential_address: "3 Cape Coast Ave, Cape Coast",
      guardian_phone: "+233200000004",
      classId: engClass.id,
    },
    {
      username: "esi.adjei",
      registration_number: "GRN005",
      first_name: "Esi",
      last_name: "Adjei",
      gender: "female",
      date_of_birth: "2010-09-01",
      residential_address: "9 Ho Road, Ho",
      guardian_phone: "+233200000005",
      classId: engClass.id,
    },
  ];

  const learnerRows = [];
  for (const l of learners) {
    const { data: learner, error: lErr } = await admin
      .from("learners")
      .insert({
        school_id: schoolId,
        username: l.username,
        registration_number: l.registration_number,
        first_name: l.first_name,
        last_name: l.last_name,
        gender: l.gender,
        date_of_birth: l.date_of_birth,
        residential_address: l.residential_address,
        guardian_phone: l.guardian_phone,
      })
      .select("id")
      .single();
    if (lErr || !learner)
      throw new Error(
        `Learner ${l.registration_number} failed: ${lErr?.message}`,
      );
    const { error: pErr } = await admin
      .from("learner_class_placements")
      .insert({
        school_id: schoolId,
        learner_id: learner.id,
        class_id: l.classId,
      });
    if (pErr)
      throw new Error(
        `Placement for ${l.registration_number} failed: ${pErr.message}`,
      );
    learnerRows.push({ ...l, id: learner.id });
  }

  console.log("Seeding attendance (Grade 9 Mathematics)...");
  const mathLearners = learnerRows.filter((l) => l.classId === mathClass.id);
  const { data: session, error: sessErr } = await admin
    .from("attendance_sessions")
    .insert({
      school_id: schoolId,
      class_id: mathClass.id,
      subject_id: mathSubject.id,
      session_date: "2026-10-30",
      recorded_by: teacher1UserId,
    })
    .select("id")
    .single();
  if (sessErr || !session)
    throw new Error(`Attendance session failed: ${sessErr?.message}`);
  const statuses = ["present", "late", "absent"];
  const { error: recErr } = await admin.from("attendance_records").insert(
    mathLearners.map((l, i) => ({
      school_id: schoolId,
      session_id: session.id,
      learner_id: l.id,
      status: statuses[i % statuses.length],
      recorded_by: teacher1UserId,
    })),
  );
  if (recErr) throw new Error(`Attendance records failed: ${recErr.message}`);

  console.log("Seeding assessments and results...");
  // Grade 9 Math assessment
  const { data: mathAssessment, error: maErr } = await admin
    .from("assessments")
    .insert({
      school_id: schoolId,
      class_id: mathClass.id,
      subject_id: mathSubject.id,
      name: "Mathematics Quiz 1",
      max_score: 20,
      assessed_on: "2026-10-28",
      created_by: teacher1UserId,
    })
    .select("id")
    .single();
  if (maErr || !mathAssessment)
    throw new Error(`Math assessment failed: ${maErr?.message}`);
  const mathScores = [18, 14, 9];
  const { error: mrErr } = await admin.from("assessment_results").insert(
    mathLearners.map((l, i) => ({
      school_id: schoolId,
      assessment_id: mathAssessment.id,
      learner_id: l.id,
      score: mathScores[i],
      graded_by: teacher1UserId,
      graded_at: new Date().toISOString(),
    })),
  );
  if (mrErr) throw new Error(`Math results failed: ${mrErr.message}`);

  // Grade 10 English assessment
  const engLearners = learnerRows.filter((l) => l.classId === engClass.id);
  const { data: engAssessment, error: eaErr } = await admin
    .from("assessments")
    .insert({
      school_id: schoolId,
      class_id: engClass.id,
      subject_id: engSubject.id,
      name: "English Essay 1",
      max_score: 50,
      assessed_on: "2026-10-29",
      created_by: teacher2UserId,
    })
    .select("id")
    .single();
  if (eaErr || !engAssessment)
    throw new Error(`English assessment failed: ${eaErr?.message}`);
  const engScores = [42, 35];
  const { error: erErr } = await admin.from("assessment_results").insert(
    engLearners.map((l, i) => ({
      school_id: schoolId,
      assessment_id: engAssessment.id,
      learner_id: l.id,
      score: engScores[i],
      graded_by: teacher2UserId,
      graded_at: new Date().toISOString(),
    })),
  );
  if (erErr) throw new Error(`English results failed: ${erErr.message}`);

  const baseUrl = "http://localhost:3000";
  console.log("\n=== Greenwood Academy seeded ===");
  console.log(`School: ${SCHOOL_NAME} (code: ${SCHOOL_CODE})`);
  console.log(`Login URL: ${baseUrl}/sign-in`);
  console.log(`School code for sign-in: ${SCHOOL_CODE}`);
  console.log("");
  console.log("Credentials:");
  console.log(`  Admin:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Teacher: ${TEACHER1_EMAIL} / ${TEACHER_PASSWORD}`);
  console.log(`  Teacher: ${TEACHER2_EMAIL} / ${TEACHER_PASSWORD}`);
  console.log("");
  console.log("Sample students:");
  for (const l of learnerRows) {
    console.log(`  ${l.registration_number} - ${l.first_name} ${l.last_name}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed failed:", err?.message ?? err);
  process.exit(1);
});
