import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  activationExpiry,
  generateActivationCode,
  type ActivationCredentialState,
} from "@/lib/domain/activation";
import { buildInternalAccountIdentifier } from "@/lib/domain/identifiers";

import { hashCredential } from "./credentials";

/**
 * Trusted account operations for the student portal, using the server-only
 * secret key (D-019, D-020).
 *
 * The secret key bypasses Row Level Security, so every exported function does
 * its own explicit authorization or resolution. Results are deliberately
 * coarse (`null` for "no such active account") so callers can return a uniform
 * failure and never reveal whether a school code, username or code existed.
 */

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export const PORTAL_PROVISION_MARKER = "school-platform";

export interface ResolvedPortalAccount {
  readonly learnerId: string;
  readonly schoolId: string;
  readonly authUserId: string;
  readonly internalIdentifier: string;
}

export interface IssuedPortalCredential {
  readonly code: string;
  readonly expiresAt: Date;
}

export type CredentialPurpose = "activation" | "reset";

interface LearnerRow {
  id: string;
  school_id: string;
  auth_user_id: string | null;
  portal_access_state: string;
}

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Resolves `(school code, username)` to an *active* portal account. The learner
 * row is authoritative: the account identifier is derived from the internal
 * student id, never from the submitted text.
 */
export async function resolvePortalAccount(
  client: AdminClient,
  params: { schoolCode: string; username: string },
): Promise<ResolvedPortalAccount | null> {
  const { data: school, error: schoolError } = await client
    .from("schools")
    .select("id, status")
    .eq("code", params.schoolCode)
    .maybeSingle();

  if (schoolError || !school || school.status !== "active") {
    return null;
  }

  const { data: learner, error: learnerError } = await client
    .from("learners")
    .select("id, auth_user_id, portal_access_state")
    .eq("school_id", school.id)
    .eq("username", params.username)
    .maybeSingle<LearnerRow>();

  if (
    learnerError ||
    !learner ||
    !learner.auth_user_id ||
    learner.portal_access_state !== "active"
  ) {
    return null;
  }

  return {
    learnerId: learner.id,
    schoolId: school.id,
    authUserId: learner.auth_user_id,
    internalIdentifier: buildInternalAccountIdentifier(learner.id),
  };
}

async function loadLearner(
  client: AdminClient,
  learnerId: string,
): Promise<LearnerRow | null> {
  const { data, error } = await client
    .from("learners")
    .select("id, school_id, auth_user_id, portal_access_state")
    .eq("id", learnerId)
    .maybeSingle<LearnerRow>();
  if (error || !data) {
    return null;
  }
  return data;
}

/**
 * Creates the Supabase Auth account for a learner if it does not yet exist, and
 * links it. The account is created with an unguessable, discarded password and
 * an un-forgeable `app_metadata` marker; the student sets the real password
 * during activation. Never exposes an email to a user.
 */
async function ensurePortalAccount(
  client: AdminClient,
  learner: LearnerRow,
): Promise<string | null> {
  if (learner.auth_user_id) {
    return learner.auth_user_id;
  }

  const identifier = buildInternalAccountIdentifier(learner.id);
  const { data, error } = await client.auth.admin.createUser({
    email: identifier,
    password: randomSecret(),
    email_confirm: true,
    app_metadata: { provisioned_by: PORTAL_PROVISION_MARKER },
  });

  if (error || !data.user) {
    return null;
  }

  const { error: linkError } = await client
    .from("learners")
    .update({
      auth_user_id: data.user.id,
      portal_access_state: "activation_pending",
    })
    .eq("id", learner.id);

  if (linkError) {
    await client.auth.admin.deleteUser(data.user.id);
    return null;
  }

  return data.user.id;
}

/**
 * Issues a single-use activation or reset credential. Any previous live
 * credential for the same learner and purpose is revoked first so the partial
 * unique index (`credentials_one_live_per_learner_purpose`) stays satisfied.
 * The raw code is returned exactly once and never stored.
 */
export async function issuePortalCredential(
  client: AdminClient,
  params: {
    learnerId: string;
    purpose: CredentialPurpose;
    issuedBy: string | null;
  },
): Promise<IssuedPortalCredential | null> {
  const learner = await loadLearner(client, params.learnerId);
  if (!learner || learner.portal_access_state === "revoked") {
    return null;
  }

  if (
    params.purpose === "activation" &&
    learner.portal_access_state === "active"
  ) {
    return null;
  }
  if (params.purpose === "reset" && !learner.auth_user_id) {
    return null;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  await client
    .from("learner_portal_credentials")
    .update({ revoked_at: nowIso })
    .eq("learner_id", learner.id)
    .eq("purpose", params.purpose)
    .is("used_at", null)
    .is("revoked_at", null);

  const code = generateActivationCode();
  const expiresAt = activationExpiry(now);

  const { error } = await client.from("learner_portal_credentials").insert({
    school_id: learner.school_id,
    learner_id: learner.id,
    purpose: params.purpose,
    credential_hash: hashCredential(code),
    issued_by: params.issuedBy,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return null;
  }

  return { code, expiresAt };
}

/**
 * Ensures the learner has a portal account and returns its Supabase Auth user
 * id. Used by the enrolment slice when an administrator first enables portal
 * access. Returns `null` if the account could not be created or linked.
 */
export async function ensureLearnerPortalAccount(
  client: AdminClient,
  learnerId: string,
): Promise<string | null> {
  const learner = await loadLearner(client, learnerId);
  if (!learner) {
    return null;
  }
  return ensurePortalAccount(client, learner);
}

interface ClaimedCredential {
  id: string;
  learner_id: string;
  school_id: string;
  purpose: CredentialPurpose;
}

/**
 * Atomically claims a live credential by consuming it. The single `UPDATE ...
 * WHERE used_at IS NULL ... RETURNING` guarantees that two concurrent
 * submissions cannot both succeed (single-use), regardless of application
 * concurrency.
 */
async function claimCredential(
  client: AdminClient,
  code: string,
): Promise<ClaimedCredential | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("learner_portal_credentials")
    .update({ used_at: nowIso })
    .eq("credential_hash", hashCredential(code))
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .select("id, learner_id, school_id, purpose")
    .maybeSingle<ClaimedCredential>();

  if (error || !data) {
    return null;
  }
  return data;
}

async function releaseClaim(
  client: AdminClient,
  credentialId: string,
): Promise<void> {
  await client
    .from("learner_portal_credentials")
    .update({ used_at: null })
    .eq("id", credentialId)
    .is("revoked_at", null);
}

export type ApplyCredentialResult =
  | { readonly ok: true; readonly purpose: CredentialPurpose }
  | {
      readonly ok: false;
      readonly reason: "invalid" | "password" | "not_permitted";
    };

/**
 * Completes activation or administrator-assisted reset: claims the single-use
 * credential, applies the student-chosen password through the admin API, and
 * (for activation) marks the learner's portal access active.
 *
 * Ordering: the credential is claimed *before* the password changes so that
 * single-use is guaranteed. If the password update fails the claim is released,
 * so the student can retry with the same code rather than being locked out.
 */
export async function applyPortalCredential(
  client: AdminClient,
  params: { code: string; newPassword: string },
): Promise<ApplyCredentialResult> {
  const claimed = await claimCredential(client, params.code);
  if (!claimed) {
    return { ok: false, reason: "invalid" };
  }

  const learner = await loadLearner(client, claimed.learner_id);
  if (
    !learner ||
    !learner.auth_user_id ||
    learner.portal_access_state === "revoked"
  ) {
    await releaseClaim(client, claimed.id);
    return { ok: false, reason: "invalid" };
  }

  if (
    claimed.purpose === "activation" &&
    learner.portal_access_state === "active"
  ) {
    await releaseClaim(client, claimed.id);
    return { ok: false, reason: "invalid" };
  }

  const { error: passwordError } = await client.auth.admin.updateUserById(
    learner.auth_user_id,
    { password: params.newPassword },
  );

  if (passwordError) {
    await releaseClaim(client, claimed.id);
    return { ok: false, reason: "password" };
  }

  if (claimed.purpose === "activation") {
    const { error: stateError } = await client
      .from("learners")
      .update({ portal_access_state: "active" })
      .eq("id", learner.id);
    if (stateError) {
      // The password is set and the credential consumed; surface as a failure
      // so an operator can reconcile rather than silently reporting success.
      return { ok: false, reason: "password" };
    }
  }

  return { ok: true, purpose: claimed.purpose };
}

/** Re-exported for callers that build their own credential-state checks. */
export type { ActivationCredentialState };
