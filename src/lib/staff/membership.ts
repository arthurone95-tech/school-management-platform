/**
 * Staff membership resolution rules.
 *
 * Pure decision logic for the staff sign-in path: given a user's membership
 * rows, decide whether they may sign in as staff, and whether an invited
 * membership should be activated on this first confirmed sign-in. The actual
 * database reads and writes happen in trusted server code (`staff-accounts.ts`).
 */

import { isStaffRole } from "@/lib/staff/requests";

export type MembershipStatus = "invited" | "active" | "suspended" | "revoked";

export interface SchoolMembershipRow {
  readonly id: string;
  readonly schoolId: string;
  readonly role: string;
  readonly status: MembershipStatus;
}

export type SignInOutcome =
  | { readonly kind: "active"; readonly membership: SchoolMembershipRow }
  | { readonly kind: "invited"; readonly membership: SchoolMembershipRow }
  | { readonly kind: "denied" }
  | { readonly kind: "not-staff" };

/**
 * Classifies a staff sign-in from the caller's membership rows.
 *
 * - `not-staff`: no school-scoped staff role (for example a student account).
 * - `active`: an active staff membership — sign in normally.
 * - `invited`: an invited staff membership with nothing else — the first
 *   successful (confirmed) sign-in activates it (D-024). The invite email's
 *   confirmation link must be followed first, because Supabase refuses
 *   password sign-in for unconfirmed emails.
 * - `denied`: suspended/revoked membership, a non-staff role, or an anomalous
 *   multiple-membership state (D-017 excludes multi-school membership in the
 *   first release). Fails closed rather than guessing.
 */
export function classifySignIn(
  rows: readonly SchoolMembershipRow[],
): SignInOutcome {
  const staffRows = rows.filter((row) => isStaffRole(row.role));

  if (staffRows.length === 0) {
    return { kind: "not-staff" };
  }
  if (staffRows.length > 1) {
    return { kind: "denied" };
  }

  const [membership] = staffRows;

  switch (membership?.status) {
    case "active":
      return { kind: "active", membership };
    case "invited":
      return { kind: "invited", membership };
    default:
      return { kind: "denied" };
  }
}
