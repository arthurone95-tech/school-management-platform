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

export type CreatePendingStaffUserResult =
  | { readonly ok: true; readonly userId: string }
  | {
      readonly ok: false;
      /** `user_exists` when the email already has a Supabase Auth account. */
      readonly reason: "user_exists" | "other";
      readonly message: string;
    };

/**
 * Creates the unconfirmed staff auth account that an invitation will activate
 * (D-025).
 *
 * No email is sent: the account is created with `email_confirm: false` and no
 * password, so it cannot sign in until the invited person accepts the shareable
 * link and chooses their own password. The `provisioned_by` marker lives in
 * `app_metadata` (never client-settable) so the sign-up guard hook permits this
 * one server-side creation path and no other.
 *
 * A single `createUser` call is enough because nothing here needs GoTrue's
 * `/invite` endpoint: removing email delivery also removes the two-step dance
 * that endpoint's `app_metadata` being ignored previously forced.
 */
export async function createPendingStaffUser(
  admin: AdminClient,
  email: string,
): Promise<CreatePendingStaffUserResult> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { provisioned_by: "school-platform" },
  });

  if (error || !data.user) {
    const exists = isUserExistsError(error);
    return {
      ok: false,
      reason: exists ? "user_exists" : "other",
      message: exists
        ? "That email already has an account."
        : "The invitation could not be created.",
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
 * Activates an invited membership. Called when an invitation is accepted
 * (D-025) and, as a safety net, on the first confirmed staff sign-in.
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
