import "server-only";

import { activationExpiry } from "@/lib/domain/activation";
import type { SchoolMembershipRow } from "@/lib/staff/membership";
import {
  generateInvitationToken,
  isValidInvitationTokenShape,
  STAFF_INVITATION_TTL_HOURS,
} from "@/lib/staff/invitations";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { hashCredential } from "./credentials";
import { activateMembership } from "./staff-accounts";

/**
 * Trusted staff-invitation operations using the server-only secret key
 * (D-025).
 *
 * The invitation credential is a bearer secret: whoever holds the link can
 * accept the invitation once. Only a keyed hash of it is stored
 * (`public.staff_invitations.credential_hash`, the same hashing rule as the
 * student credential store), it is never logged, and it is returned to the
 * caller exactly once, at issue.
 *
 * The secret key bypasses Row Level Security, so every exported function does
 * its own explicit resolution and scoping. Callers still enforce identity,
 * school and permission checks first (`staff-accounts.ts`, the invite route).
 */

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export interface IssueStaffInvitationParams {
  readonly schoolId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly invitedBy: string | null;
}

export interface IssuedStaffInvitation {
  readonly invitationId: string;
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * An unaccepted invitation for one recipient in one school, used to decide
 * whether an invite request is a first invitation or a re-invitation of an
 * existing pending member.
 */
export interface UnacceptedStaffInvitation {
  readonly invitationId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly role: string;
}

export interface StaffInvitationView {
  readonly email: string;
  readonly role: string;
  readonly expiresAt: string;
  readonly schoolName: string | null;
}

export type StaffInvitationAcceptance =
  | { readonly ok: true; readonly email: string; readonly role: string }
  | {
      readonly ok: false;
      /** `invalid` covers unknown, expired, revoked and already-used links. */
      readonly reason: "invalid" | "password" | "activation";
    };

interface InvitationRow {
  id: string;
  school_id: string;
  membership_id: string;
  user_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

interface MembershipRow {
  id: string;
  school_id: string;
  role: string;
  status: string;
}

/** Appends an actor-attributed lifecycle event without recording the credential. */
async function recordInvitationEvent(
  client: AdminClient,
  params: {
    schoolId: string;
    actorUserId: string | null;
    action:
      | "staff_invitation_created"
      | "staff_invitation_accepted"
      | "staff_invitation_revoked";
    invitationId: string;
  },
): Promise<void> {
  await client.from("audit_events").insert({
    school_id: params.schoolId,
    actor_user_id: params.actorUserId,
    action: params.action,
    target_table: "staff_invitations",
    target_id: params.invitationId,
    details: {},
  });
}

/**
 * Invalidates every live invitation for a membership. Called before issuing a
 * replacement so the partial unique index stays satisfied and any previously
 * shared link stops working immediately.
 */
export async function revokeLiveInvitations(
  client: AdminClient,
  membershipId: string,
): Promise<void> {
  await client
    .from("staff_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("membership_id", membershipId)
    .is("accepted_at", null)
    .is("revoked_at", null);
}

/**
 * Issues a single-use, expiring invitation link credential and stores only its
 * hash. The raw token is returned once and never persisted or logged.
 *
 * Any previous live invitation for the same membership is revoked first, so
 * issuing a replacement cannot leave two working links.
 */
export async function issueStaffInvitation(
  client: AdminClient,
  params: IssueStaffInvitationParams,
): Promise<IssuedStaffInvitation | null> {
  await revokeLiveInvitations(client, params.membershipId);

  const token = generateInvitationToken();
  const now = new Date();
  const expiresAt = activationExpiry(now, STAFF_INVITATION_TTL_HOURS);

  const { data, error } = await client
    .from("staff_invitations")
    .insert({
      school_id: params.schoolId,
      membership_id: params.membershipId,
      user_id: params.userId,
      email: params.email,
      role: params.role,
      invited_by: params.invitedBy,
      credential_hash: hashCredential(token),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return null;
  }

  await recordInvitationEvent(client, {
    schoolId: params.schoolId,
    actorUserId: params.invitedBy,
    action: "staff_invitation_created",
    invitationId: data.id,
  });

  return { invitationId: data.id, token, expiresAt };
}

/**
 * Finds the most recent not-yet-accepted invitation for one recipient in one
 * school, if any. Used to re-invite an existing pending member instead of
 * failing on the already-created Auth account. Scoped by school, so it can
 * never surface another school's invitation.
 */
export async function findUnacceptedStaffInvitation(
  client: AdminClient,
  params: { schoolId: string; email: string },
): Promise<UnacceptedStaffInvitation | null> {
  const { data, error } = await client
    .from("staff_invitations")
    .select("id, membership_id, user_id, role")
    .eq("school_id", params.schoolId)
    .eq("email", params.email)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      membership_id: string;
      user_id: string;
      role: string;
    }>();

  if (error || !data) {
    return null;
  }

  return {
    invitationId: data.id,
    membershipId: data.membership_id,
    userId: data.user_id,
    role: data.role,
  };
}

/**
 * Resolves a link credential for the acceptance page: it must be well formed,
 * match a stored hash, and still be live (not accepted, not revoked, not
 * expired). Returns `null` for every unusable case, so the caller can answer
 * uniformly and never reveal which part failed.
 */
export async function previewStaffInvitation(
  client: AdminClient,
  token: string,
): Promise<StaffInvitationView | null> {
  if (!isValidInvitationTokenShape(token)) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("staff_invitations")
    .select("id, school_id, email, role, expires_at, accepted_at, revoked_at")
    .eq("credential_hash", hashCredential(token))
    .gt("expires_at", nowIso)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle<InvitationRow>();

  if (error || !data) {
    return null;
  }

  const { data: school } = await client
    .from("schools")
    .select("name")
    .eq("id", data.school_id)
    .maybeSingle<{ name: string }>();

  return {
    email: data.email,
    role: data.role,
    expiresAt: data.expires_at,
    schoolName: school?.name ?? null,
  };
}

/** Releases a claimed invitation so a failed attempt can be retried. */
async function releaseClaim(
  client: AdminClient,
  invitationId: string,
): Promise<void> {
  await client
    .from("staff_invitations")
    .update({ accepted_at: null })
    .eq("id", invitationId)
    .is("revoked_at", null);
}

/**
 * Completes invitation acceptance: claims the single-use credential, applies
 * the recipient's chosen password through the Supabase admin API (which also
 * confirms the email so password sign-in is possible), and activates the
 * membership.
 *
 * Ordering and concurrency: the credential is claimed with a single
 * `UPDATE … WHERE accepted_at IS NULL … RETURNING`, so two concurrent
 * submissions cannot both succeed. If the password update fails the claim is
 * released so the recipient can retry with the same link. If only the
 * membership activation fails the credential stays consumed; the first
 * confirmed sign-in re-activates an invited membership as a safety net.
 *
 * The school, recipient and role come from the stored invitation, never from
 * the request, so a caller cannot redirect the activation elsewhere.
 */
export async function acceptStaffInvitation(
  client: AdminClient,
  params: { token: string; newPassword: string },
): Promise<StaffInvitationAcceptance> {
  if (!isValidInvitationTokenShape(params.token)) {
    return { ok: false, reason: "invalid" };
  }

  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimError } = await client
    .from("staff_invitations")
    .update({ accepted_at: nowIso })
    .eq("credential_hash", hashCredential(params.token))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .select("id, school_id, membership_id, user_id, email, role")
    .maybeSingle<InvitationRow>();

  if (claimError || !claimed) {
    return { ok: false, reason: "invalid" };
  }

  const { data: membership, error: membershipError } = await client
    .from("school_members")
    .select("id, school_id, role, status")
    .eq("id", claimed.membership_id)
    .maybeSingle<MembershipRow>();

  if (
    membershipError ||
    !membership ||
    membership.school_id !== claimed.school_id ||
    membership.status !== "invited"
  ) {
    await releaseClaim(client, claimed.id);
    return { ok: false, reason: "invalid" };
  }

  const { error: passwordError } = await client.auth.admin.updateUserById(
    claimed.user_id,
    { password: params.newPassword, email_confirm: true },
  );

  if (passwordError) {
    await releaseClaim(client, claimed.id);
    return { ok: false, reason: "password" };
  }

  const membershipRow: SchoolMembershipRow = {
    id: membership.id,
    schoolId: membership.school_id,
    role: membership.role,
    status: "invited",
  };
  const activated = await activateMembership(
    client,
    membershipRow,
    claimed.user_id,
  );

  if (!activated) {
    return { ok: false, reason: "activation" };
  }

  await recordInvitationEvent(client, {
    schoolId: claimed.school_id,
    actorUserId: claimed.user_id,
    action: "staff_invitation_accepted",
    invitationId: claimed.id,
  });

  return { ok: true, email: claimed.email, role: claimed.role };
}

/**
 * Revokes a live invitation, invalidating the shared link immediately. Scoped
 * by school, and only accepted-or-revoked rows are excluded, so a caller can
 * never revoke another school's invitation or an already-accepted one.
 *
 * The pending account and membership are left in place deliberately: an
 * `invited` membership grants nothing, and the account has no password and an
 * unconfirmed email, so it cannot sign in. They can be re-invited from the same
 * school (a new link replaces the revoked one).
 */
export async function revokeStaffInvitation(
  client: AdminClient,
  params: { schoolId: string; invitationId: string; actorUserId: string },
): Promise<boolean> {
  const { data, error } = await client
    .from("staff_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.invitationId)
    .eq("school_id", params.schoolId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    return false;
  }

  await recordInvitationEvent(client, {
    schoolId: params.schoolId,
    actorUserId: params.actorUserId,
    action: "staff_invitation_revoked",
    invitationId: data.id,
  });

  return true;
}
