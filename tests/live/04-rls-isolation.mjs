// Live check 04: tenant isolation and RLS against the real project.
//
// Uses real user JWTs against PostgREST (the same path the browser uses), not
// SQL role simulation, so the policies, grants and JWT claims are all
// exercised as they are in production.
import { createClient } from "@supabase/supabase-js";

import { requiredClientConfig } from "./env.mjs";
import { adminClient, loadState, createReporter } from "./lib.mjs";

const { url, publishable } = requiredClientConfig();
const state = loadState();
const report = createReporter("RLS / isolation");

function clientFor(accessToken) {
  return createClient(url, publishable, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email, password) {
  const client = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { token: data.session.access_token, userId: data.user.id };
}

const A = state.learners.A;
const B = state.learners.B;

async function main() {
  const adminA = await signIn(state.admins.A.email, state.admins.A.password);
  const asA = clientFor(adminA.token);

  // A school A administrator sees only school A.
  const ownLearners = await asA.from("learners").select("id, username");
  report.check(
    ownLearners.error === null &&
      ownLearners.data?.length === 1 &&
      ownLearners.data[0].id === A.id,
    "admin A sees exactly its own learner",
    `error=${ownLearners.error?.code ?? "none"} rows=${ownLearners.data?.length}`,
  );

  const otherSchoolLearners = await asA
    .from("learners")
    .select("id")
    .eq("school_id", state.schools.B);
  report.check(
    otherSchoolLearners.data?.length === 0,
    "admin A requesting school B learners receives nothing",
    `rows=${otherSchoolLearners.data?.length}`,
  );

  const readSchoolB = await asA
    .from("schools")
    .select("id")
    .eq("id", state.schools.B);
  report.check(
    readSchoolB.data?.length === 0,
    "admin A cannot read school B row",
    `rows=${readSchoolB.data?.length}`,
  );

  // Credentials table: no policy and no grant for authenticated.
  const credentials = await asA
    .from("learner_portal_credentials")
    .select("id")
    .limit(1);
  report.check(
    credentials.error !== null,
    "authenticated user cannot read portal credentials (no grant)",
    `error=${credentials.error?.code ?? "NONE"}`,
  );

  // Cross-school write is refused.
  const writeB = await asA.from("learners").insert({
    school_id: state.schools.B,
    registration_number: `X-${Date.now()}`,
    first_name: "Mallory",
    last_name: "Intruder",
    gender: "other",
    date_of_birth: "2010-01-01",
    residential_address: "Nowhere",
    guardian_phone: "+233200000999",
    username: `mallory.${Date.now()}`,
  });
  report.check(
    writeB.error !== null,
    "admin A cannot insert into school B",
    `error=${writeB.error?.code ?? "NONE"}`,
  );

  // Cross-school update is refused (0 rows affected, no error).
  const updateB = await asA
    .from("learners")
    .update({ first_name: "Tampered" })
    .eq("id", B.id)
    .select("id");
  report.check(
    (updateB.data?.length ?? 0) === 0,
    "admin A cannot update school B learner",
    `rows=${updateB.data?.length} error=${updateB.error?.code ?? "none"}`,
  );

  // Permission helper is school-scoped.
  const permOwn = await asA.rpc("has_school_permission", {
    target_school_id: state.schools.A,
    required_permission: "learner.portal.manage",
  });
  const permOther = await asA.rpc("has_school_permission", {
    target_school_id: state.schools.B,
    required_permission: "learner.portal.manage",
  });
  report.check(
    permOwn.data === true,
    "has_school_permission true for own school",
    `=${permOwn.data}`,
  );
  report.check(
    permOther.data === false,
    "has_school_permission false for another school",
    `=${permOther.data}`,
  );

  // Audit trail is readable with the permission, and school-scoped.
  const auditA = await asA
    .from("audit_events")
    .select("id, school_id")
    .limit(5);
  report.check(
    auditA.error === null &&
      (auditA.data ?? []).every((row) => row.school_id === state.schools.A),
    "audit events are readable and scoped to own school",
    `error=${auditA.error?.code ?? "none"} rows=${auditA.data?.length}`,
  );

  // Anonymous (publishable key, no user) is denied on protected tables.
  const anon = clientFor(null);
  const anonLearners = await anon.from("learners").select("id").limit(1);
  report.check(
    anonLearners.error !== null,
    "anon cannot read learners (no grant)",
    `error=${anonLearners.error?.code ?? "NONE"}`,
  );

  // A student session must not grant staff-level school access.
  const internalEmail = `${A.id}@students.invalid`;
  const student = await signIn(internalEmail, "ResetPassword123!");
  const asStudent = clientFor(student.token);
  const studentLearners = await asStudent.from("learners").select("id");
  report.check(
    studentLearners.data?.length === 0,
    "student session cannot list school learners (not a member)",
    `rows=${studentLearners.data?.length} error=${studentLearners.error?.code ?? "none"}`,
  );
  const studentPerm = await asStudent.rpc("has_school_permission", {
    target_school_id: state.schools.A,
    required_permission: "learner.read",
  });
  report.check(
    studentPerm.data === false,
    "student has no school permission",
    `=${studentPerm.data}`,
  );

  // The service-only key still bypasses RLS (server path), proving isolation is
  // enforced by policy and not by an accidental global lock.
  const privileged = adminClient();
  const allLearners = await privileged.from("learners").select("id");
  report.check(
    (allLearners.data?.length ?? 0) >= 2,
    "service key can read across schools (RLS bypassed only server-side)",
    `rows=${allLearners.data?.length}`,
  );

  process.exitCode = report.summary() ? 0 : 1;
}

main().catch((error) => {
  console.error("rls test error:", error.message ?? error);
  process.exit(1);
});
