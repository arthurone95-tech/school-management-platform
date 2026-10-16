import type { InvitationStatus } from "@/lib/staff/invitation-status";

const LABELS: Record<InvitationStatus, string> = {
  pending: "Awaiting acceptance",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

/**
 * Status indicator for a staff invitation.
 *
 * The status is always spelled out, never signalled by colour alone
 * (docs/UI_UX_DOCUMENTATION.md 11 and the accessibility target in D-016).
 */
export function InvitationStatusBadge({
  status,
}: {
  readonly status: InvitationStatus;
}) {
  return <span className={`badge badge--${status}`}>{LABELS[status]}</span>;
}
