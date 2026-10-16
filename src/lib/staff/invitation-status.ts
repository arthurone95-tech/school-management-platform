/**
 * Derived state of a staff invitation row for display (D-025).
 *
 * Pure and isomorphic so the staff-facing invitation list shows one status per
 * invitation without re-implementing the precedence rules in the UI. The stored
 * row keeps its own timestamps; this only labels them.
 */

export type InvitationStatus = "accepted" | "revoked" | "expired" | "pending";

export interface InvitationTimestamps {
  readonly acceptedAt: string | null;
  readonly revokedAt: string | null;
  readonly expiresAt: string;
}

/**
 * Labels an invitation. Precedence: a completed acceptance or an explicit
 * revocation outranks expiry, so an accepted row still reads "accepted" and a
 * revoked link is never shown as merely "expired".
 */
export function deriveInvitationStatus(
  timestamps: InvitationTimestamps,
  now: Date,
): InvitationStatus {
  if (timestamps.acceptedAt) {
    return "accepted";
  }
  if (timestamps.revokedAt) {
    return "revoked";
  }
  if (new Date(timestamps.expiresAt).getTime() <= now.getTime()) {
    return "expired";
  }
  return "pending";
}

/**
 * Whether a link can still be accepted. This mirrors the server's claim
 * conditions (`accepted_at`, `revoked_at` null and `expires_at` in the future);
 * it is a display helper, not an authorization decision.
 */
export function isLiveInvitation(
  timestamps: InvitationTimestamps,
  now: Date,
): boolean {
  return deriveInvitationStatus(timestamps, now) === "pending";
}
