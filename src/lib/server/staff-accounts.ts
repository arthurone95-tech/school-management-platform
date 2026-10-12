import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  MembershipStatus,
  SchoolMembershipRow,
} from "@/lib/staff/membership";

/**
 * Trusted staff-account operations using the server-only secret key.
 *
 * The secret key bypasses Row Level Security, so every exported function does
 * its own explicit resolution and the callers still enforce identity and
 * permission checks first (docs/DECISIONS.md D-021, D-024).
 */

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/** Reads a GoTrue-style error's code or message for classification. */
function getErrorCode(error: unknown): string {
  const maybe = error as { code?: string; message?: string } | null;
  return maybe?.code ?? maybe?.message ?? "";
}

export type InviteUserResult =
  | { readonly ok: true; readonly userId: string }
  | {
      readonly ok: false;
      /** `user_exists` when the email already has a Supabase Auth account. */
      readonly reason: "user_exists" | "other";
      readonly message: string;
    };

/**
 * Creates the staff auth user and sends Supabase's built-in invitation email
 * (single-use, expiring confirmation token). The invited user follows the link
 * to `/auth/confirm`, chooses a password at `/join` (D-024), and is then able
 * to sign in; the first sign-in activates their `school_members` row.
 *
 * The invitation is sent in two steps because GoTrue's `/invite` endpoint
 * ignores `app_metadata`, so a directly invited user would never carry the
 * `provisioned_by` marker the sign-up guard hook requires:
 *
 * 1. `createUser` creates an unconfirmed account carrying the marker (the same
 *    path the seed uses, so the hook permits it).
 * 2. `inviteUserByEmail` on the now-existing user triggers GoTrue's official
 *    invitation email. The hook only fires on the create path, so the invite is
 *    not blocked, and the single-use confirmation token is still issued.
 *
 * This keeps the guard hook's rule — only the platform server (this code) can
 * create accounts — intact without moving the marker to client-spoofable
 * `user_metadata`.
 */
export async function inviteStaffUser(
  admin: AdminClient,
  email: string,
  redirectTo: string,
): Promise<InviteUserResult> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { provisioned_by: "school-platform" },
  });

  if (error) {
    return {
      ok: false,
      reason: isUserExistsError(error) ? "user_exists" : "other",
      message: isUserExistsError(error)
        ? "That email already has an account."
        : "The invitation could not be sent.",
    };
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo },
  );
  if (inviteError) {
    // Roll back the placeholder account so a later attempt starts clean.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    return {
      ok: false,
      reason: "other",
      message: "The invitation could not be sent.",
    };
  }

  return { ok: true, userId: data.user.id };
}

/** Whether a GoTrue error is the "email already has an account" failure. */
function isUserExistsError(error: unknown): boolean {
  const code = getErrorCode(error);
  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    code === "User already registered"
  );
}

export type MembershipsResult =
  | { readonly ok: true; readonly rows: SchoolMembershipRow[] }
  | { readonly ok: false; readonly message: string };

/**
 * Reads a user's membership rows with the service key. Used by the staff
 * sign-in path after Supabase has already verified the password, so the
 * resolution cannot be used to enumerate accounts.
 */
export async function findMembershipsForUser(
  admin: AdminClient,
  userId: string,
): Promise<MembershipsResult> {
  const { data, error } = await admin
    .from("school_members")
    .select("id, school_id, role, status")
    .eq("user_id", userId);

  if (error) {
    return { ok: false, message: "Membership could not be resolved." };
  }

  const rows: SchoolMembershipRow[] = (data ?? []).map((row) => ({
    id: row.id,
    schoolId: row.school_id,
    role: row.role,
    status: row.status as MembershipStatus,
  }));

  return { ok: true, rows };
}

/**
 * Activates an invited membership after the first confirmed staff sign-in.
 *
 * The status change is recorded by the `school_members` audit trigger
 * (changed columns only); this call additionally appends an explicit,
 * actor-attributed audit event so the activation of a staff member is
 * attributable even though the update itself runs with the service key.
 */
export async function activateMembership(
  admin: AdminClient,
  membership: SchoolMembershipRow,
  actorUserId: string,
): Promise<boolean> {
  const { error: updateError } = await admin
    .from("school_members")
    .update({ status: "active" })
    .eq("id", membership.id);

  if (updateError) {
    return false;
  }

  const { error: auditError } = await admin.from("audit_events").insert({
    school_id: membership.schoolId,
    actor_user_id: actorUserId,
    action: "staff_membership_activated",
    target_table: "school_members",
    target_id: membership.id,
    details: {},
  });

  return auditError === null;
}
