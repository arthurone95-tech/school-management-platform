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
}: {
  readonly variant?: AlertVariant;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={["alert", `alert--${variant}`, className ?? ""]
        .filter(Boolean)
        .join(" ")}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
