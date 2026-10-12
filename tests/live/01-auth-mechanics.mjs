// Live check 01: does Supabase accept the internal `.invalid` identity model?
//
// Proves, against the real project:
//   a) an admin-created user with an RFC 2606 `.invalid` email is accepted
//      (email_confirm) and carries an un-forgeable app_metadata marker;
//   b) that identity can sign in with a password (the mechanism the portal
//      sign-in route relies on);
//   c) the resulting access token is a valid `authenticated` JWT for PostgREST;
//   d) whether public self-sign-up is currently enabled (relevant to the
//      "reserved namespace" requirement).
//
// It creates and then deletes its own throwaway users. No secrets are printed.
import { createClient } from "@supabase/supabase-js";
import { requiredClientConfig } from "./env.mjs";

const { url, publishable, secret } = requiredClientConfig();

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, publishable, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${detail}`);
}

const internalEmail = `probe-${crypto.randomUUID()}@students.invalid`;
const password = `${crypto.randomUUID().replaceAll("-", "")}Aa1!`;
let createdId = null;

// (a) admin create with .invalid email + app_metadata marker
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: internalEmail,
  password,
  email_confirm: true,
  app_metadata: { provisioned_by: "school-platform" },
});
createdId = created?.user?.id ?? null;
record(
  "admin.createUser with .invalid email",
  !createErr,
  createErr
    ? `${createErr.status} ${createErr.message}`
    : `id=${created.user.id} confirmed=${Boolean(created.user.email_confirmed_at)} marker=${created.user.app_metadata?.provisioned_by}`,
);

// (b) password sign-in with that identity
let accessToken = null;
if (createdId) {
  const { data: session, error: signInErr } =
    await anon.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
  accessToken = session?.session?.access_token ?? null;
  record(
    "signInWithPassword (internal identity)",
    !signInErr && Boolean(accessToken),
    signInErr
      ? `${signInErr.status} ${signInErr.message}`
      : `sub=${session.session.user.id}`,
  );
}

// (c) the token works against PostgREST as `authenticated`
if (accessToken) {
  const authed = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: readErr } = await authed
    .from("role_permissions")
    .select("role")
    .limit(1);
  record(
    "authenticated JWT can read role_permissions via PostgREST",
    !readErr,
    readErr ? `${readErr.code} ${readErr.message}` : "allowed",
  );
}

// (d) is public self-sign-up open?
const selfSignup = await anon.auth.signUp({
  email: `probe-signup-${crypto.randomUUID()}@students.invalid`,
  password: `${crypto.randomUUID().replaceAll("-", "")}Aa1!`,
});
record(
  "public self-sign-up status",
  true,
  selfSignup.error
    ? `blocked: ${selfSignup.error.status} ${selfSignup.error.message}`
    : `ENABLED (user id=${selfSignup.data.user?.id ?? "none"})`,
);
if (selfSignup.data?.user?.id) {
  await admin.auth.admin.deleteUser(selfSignup.data.user.id);
}

// cleanup
if (createdId) {
  const { error: delErr } = await admin.auth.admin.deleteUser(createdId);
  record("cleanup deleteUser", !delErr, delErr ? delErr.message : "deleted");
}

console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} checks passed`,
);
