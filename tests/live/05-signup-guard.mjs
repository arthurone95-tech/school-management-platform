// Live check 05: self-registration is not possible.
//
// Two independent controls protect the reserved `students.invalid` identity
// namespace (D-020):
//   1. public sign-up is disabled on the project; and
//   2. the `before_user_created` Auth Hook refuses any sign-up that the platform
//      server did not provision.
//
// The hook runs on the sign-up path only. The service-role admin API does not go
// through it — that path is protected by the key never leaving the server. This
// script checks what is checkable with keys; the hook's sign-up-path invocation
// is recorded in docs/PHASE0_RISK_REGISTER.md 10.4.
import { adminClient, anonClient, createReporter } from "./lib.mjs";

const admin = adminClient();
const anon = anonClient();
const report = createReporter("signup guard");

function randomPassword() {
  return `Zz!${crypto.randomUUID().replaceAll("-", "")}`;
}

async function main() {
  // (1) Public sign-up is refused outright.
  const publicSignup = await anon.auth.signUp({
    email: `probe-public-${crypto.randomUUID()}@example.com`,
    password: randomPassword(),
  });
  report.check(
    publicSignup.error !== null,
    "public sign-up is refused",
    publicSignup.error
      ? `${publicSignup.error.status} ${publicSignup.error.message}`
      : "ENABLED",
  );

  // (2) The reserved namespace cannot be self-registered either.
  const reservedSignup = await anon.auth.signUp({
    email: `probe-reserved-${crypto.randomUUID()}@students.invalid`,
    password: randomPassword(),
  });
  report.check(
    reservedSignup.error !== null,
    "self sign-up into students.invalid is refused",
    reservedSignup.error
      ? `${reservedSignup.error.status} ${reservedSignup.error.message}`
      : "ENABLED",
  );

  // (3) The platform's own provisioning path still works (it stamps the marker
  //     and uses the service key).
  const marked = await admin.auth.admin.createUser({
    email: `probe-marked-${crypto.randomUUID()}@students.invalid`,
    password: randomPassword(),
    email_confirm: true,
    app_metadata: { provisioned_by: "school-platform" },
  });
  report.check(
    marked.error === null && Boolean(marked.data?.user?.id),
    "server-provisioned account creation still works",
    marked.error
      ? `${marked.error.status} ${marked.error.message}`
      : `id=${marked.data.user.id}`,
  );

  if (marked.data?.user?.id) {
    const { error } = await admin.auth.admin.deleteUser(marked.data.user.id);
    report.check(!error, "cleanup: probe user removed", error?.message ?? "ok");
  }

  process.exitCode = report.summary() ? 0 : 1;
}

main().catch((error) => {
  console.error("guard test error:", error.message ?? error);
  process.exit(1);
});
