import type { ReactNode } from "react";

/**
 * Page-level heading with an optional description and action buttons
 * (docs/UI_UX_DOCUMENTATION.md 10).
 *
 * Every dashboard and public page renders exactly one `<h1>`; this component
 * owns it so titles, descriptions and page actions line up the same way
 * everywhere. Presentational and hook-free, so it renders from a Server or a
 * Client Component.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {description ? (
          <p className="page-header__description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
