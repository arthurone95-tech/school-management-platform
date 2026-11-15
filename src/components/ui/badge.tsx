import type { ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "pending"
  | "accepted"
  | "expired"
  | "revoked"
  | "active"
  | "inactive";

/**
 * Small status pill (docs/UI_UX_DOCUMENTATION.md 11).
 *
 * The text always states the status, so colour is never the only signal. Use
 * the semantic variants (`info`, `success`, `warning`, `danger`, `neutral`)
 * for general statuses and the named ones for the invitation and enrolment
 * statuses already defined in the design system.
 */
export function Badge({
  variant = "neutral",
  children,
}: {
  readonly variant?: BadgeVariant;
  readonly children: ReactNode;
}) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
