// Live seed: two isolated schools, an active administrator in each, one class
// and one learner per school. Idempotent: any previous run's data for these
// fixed school codes is removed first.
//
// Fixed test codes avoid I/O/S/Z, which the schema alphabet forbids:
//   school A = ALPHA, school B = DELTA.
import { adminClient, randomPassword, saveState } from "./lib.mjs";

const admin = adminClient();

const SCHOOLS = [
  { key: "A", code: "ALPHA", name: "Alpha Community School" },
  { key: "B", code: "DELTA", name: "Delta Community School" },
];

const STATE = { schools: {}, admins: {}, learners: {} };

async function findUserByEmail(email) {
  // listUsers is paginated; the dev project is tiny.
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

async function ensureAuthUser(email, password) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { provisioned_by: "school-platform" },
    });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provisioned_by: "school-platform" },
  });
  if (error) throw error;
  return data.user.id;
}

/** Removes a previous run for the given school codes, in FK-safe order. */
async function cleanupSchoolCode(code) {
  const { data: school } = await admin
    .from("schools")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!school) return;

  const { data: learners } = await admin
    .from("learners")
    .select("id, auth_user_id")
    .eq("school_id", school.id);
  const learnerIds = (learners ?? []).map((l) => l.id);
  const authIds = (learners ?? []).map((l) => l.auth_user_id).filter(Boolean);

  const steps = [
    // Attendance first: its records reference learners with ON DELETE RESTRICT,
    // so they must go before the learners, and its sessions reference classes,
    // subjects and terms.
    () => admin.from("attendance_records").delete().eq("school_id", school.id),
    () => admin.from("attendance_sessions").delete().eq("school_id", school.id),
    () =>
      learnerIds.length
        ? admin
            .from("learner_portal_credentials")
            .delete()
            .in("learner_id", learnerIds)
        : null,
    () =>
      learnerIds.length
        ? admin
            .from("learner_class_placements")
            .delete()
            .in("learner_id", learnerIds)
        : null,
    () =>
      learnerIds.length
        ? admin.from("learners").delete().in("id", learnerIds)
        : null,
    // Staff assignments reference classes and members with ON DELETE RESTRICT.
    () => admin.from("staff_assignments").delete().eq("school_id", school.id),
    () => admin.from("staff_invitations").delete().eq("school_id", school.id),
    () => admin.from("subjects").delete().eq("school_id", school.id),
    () => admin.from("terms").delete().eq("school_id", school.id),
    () => admin.from("academic_years").delete().eq("school_id", school.id),
    () => admin.from("classes").delete().eq("school_id", school.id),
    () => admin.from("school_members").delete().eq("school_id", school.id),
    // Audit rows are append-only for users but must be cleared before the
    // school row (school_id -> schools uses ON DELETE RESTRICT). Deleting the
    // learners, classes and members above appended further audit rows.
    () => admin.from("audit_events").delete().eq("school_id", school.id),
    () => admin.from("schools").delete().eq("id", school.id),
  ];

  for (const step of steps) {
    const result = step();
    if (!result) continue;
    const { error } = await result;
    if (error) throw new Error(`cleanup ${code} failed: ${error.message}`);
  }

  for (const id of authIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error)
      throw new Error(`cleanup ${code} auth user failed: ${error.message}`);
  }
}

async function main() {
  for (const school of SCHOOLS) {
    await cleanupSchoolCode(school.code);
  }

  for (const school of SCHOOLS) {
    const { data: created, error } = await admin
      .from("schools")
      .insert({ code: school.code, name: school.name })
      .select("id, code")
      .single();
    if (error) throw error;
    STATE.schools[school.key] = created.id;

    const adminEmail = `admin.${school.code.toLowerCase()}@example.com`;
    const adminPassword = randomPassword();
    const adminUserId = await ensureAuthUser(adminEmail, adminPassword);
    STATE.admins[school.key] = {
      email: adminEmail,
      password: adminPassword,
      userId: adminUserId,
    };

    const { error: memberError } = await admin.from("school_members").insert({
      school_id: created.id,
      user_id: adminUserId,
      role: "school_administrator",
      status: "active",
    });
    if (memberError) throw memberError;

    const { error: classError } = await admin
      .from("classes")
      .insert({ school_id: created.id, name: "Primary 1" })
      .select("id")
      .single();
    if (classError) throw classError;

    const learner = {
      school_id: created.id,
      registration_number: `${school.code}-001`,
      first_name: school.key === "A" ? "Ama" : "Kofi",
      last_name: school.key === "A" ? "Mensah" : "Boateng",
      gender: school.key === "A" ? "female" : "male",
      date_of_birth: school.key === "A" ? "2015-04-09" : "2014-11-23",
      residential_address: `${school.key} Street, Accra`,
      guardian_phone: school.key === "A" ? "+233200000001" : "+233200000002",
      username: school.key === "A" ? "ama.mensah" : "kofi.boateng",
      status: "active",
    };

    const { data: learnerRow, error: learnerError } = await admin
      .from("learners")
      .insert(learner)
      .select("id, username")
      .single();
    if (learnerError) throw learnerError;

    STATE.learners[school.key] = {
      id: learnerRow.id,
      username: learnerRow.username,
      password: randomPassword(),
    };
  }

  saveState(STATE);

  console.log("Seeded:");
  for (const school of SCHOOLS) {
    console.log(
      `  ${school.code}: school=${STATE.schools[school.key]} admin=${STATE.admins[school.key].email} learner(username)=${STATE.learners[school.key].username}`,
    );
  }
  console.log(`State written to ${"live-state.json"} (values not printed).`);
}

main().catch((error) => {
  console.error("seed failed:", error.message ?? error);
  process.exit(1);
});
