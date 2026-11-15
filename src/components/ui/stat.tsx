import type { ReactNode } from "react";

/** A responsive row of summary figures (docs/UI_UX_DOCUMENTATION.md 10). */
export function StatGrid({ children }: { readonly children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

/**
 * One summary figure. `label` names the figure, `value` is the figure itself
 * and `hint` adds the unit or context ("of 240 learners"). The value is text,
 * so it is read by a screen reader exactly as shown.
 */
export function StatCard({
  label,
  value,
  hint,
}: {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
}) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  );
}
