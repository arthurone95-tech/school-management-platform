import type { ReactNode } from "react";
import Link from "next/link";

/** A responsive row of summary figures (docs/UI_UX_DOCUMENTATION.md 10). */
export function StatGrid({ children }: { readonly children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

/**
 * One summary figure in a flat card. `label` names the figure, `value` is the
 * figure itself and `hint` adds the unit or context ("of 240 learners"). The
 * value is text, so it is read by a screen reader exactly as shown. Pass
 * `href` to make the whole card a link.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly href?: string;
}) {
  const body = (
    <>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </>
  );

  if (!href) {
    return <div className="stat-card">{body}</div>;
  }
  return (
    <Link href={href} className="stat-card stat-card--link">
      {body}
    </Link>
  );
}
