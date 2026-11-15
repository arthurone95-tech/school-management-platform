import type { ReactNode } from "react";

/**
 * Placeholder shown when a list or screen has nothing to display yet
 * (docs/UI_UX_DOCUMENTATION.md 8 and 10).
 *
 * The title states the situation plainly; `description` explains what to do
 * next and `actions` offers the way to do it. Pass a `lucide-react` icon at
 * 20px as `icon` when one helps.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <p className="empty-state__title">{title}</p>
      {description ? (
        <p className="empty-state__description">{description}</p>
      ) : null}
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  );
}
