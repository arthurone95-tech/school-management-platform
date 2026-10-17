import type { ReactNode } from "react";

export type AlertVariant = "error" | "success" | "warning" | "info";

/**
 * Inline feedback for a successful, failed or pending operation
 * (docs/UI_UX_DOCUMENTATION.md 8).
 *
 * Errors are announced assertively (`role="alert"`); everything else politely
 * (`role="status"`), so a screen reader reports the outcome without stealing
 * focus.
 */
export function Alert({
  variant = "info",
  children,
  className,
  role,
}: {
  readonly variant?: AlertVariant;
  readonly children: ReactNode;
  readonly className?: string;
  /**
   * Overrides the implicit live-region role. The default is `alert` for errors
   * and `status` otherwise; pass `role={null}` when the message is static page
   * copy rather than the outcome of an operation, so it is not announced on
   * load.
   */
  readonly role?: "alert" | "status" | null;
}) {
  return (
    <div
      className={["alert", `alert--${variant}`, className ?? ""]
        .filter(Boolean)
        .join(" ")}
      role={
        role === undefined
          ? variant === "error"
            ? "alert"
            : "status"
          : (role ?? undefined)
      }
    >
      {children}
    </div>
  );
}
