import type { ReactNode } from "react";

/**
 * Shared shell for the unauthenticated pages (staff sign-in, school sign-up
 * and the student portal) so they share one centred, flat layout
 * (docs/UI_UX_DOCUMENTATION.md 10).
 *
 * It renders the page's single `<main id="main">` and `<h1>`. The form or
 * content goes in `children`; `footer` holds the small links beneath the card.
 */
export function AuthShell({
  brand = "School Management Platform",
  title,
  description,
  children,
  footer,
}: {
  readonly brand?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  return (
    <main className="auth-shell" id="main">
      <div className="auth-card">
        <p className="auth-shell__brand-name">{brand}</p>

        <section className="card">
          <div className="card__header">
            <div>
              <h1 className="auth-shell__title">{title}</h1>
              {description ? (
                <p className="card__description">{description}</p>
              ) : null}
            </div>
          </div>
          <div className="card__body">{children}</div>
        </section>

        {footer ? <div className="auth-shell__footer">{footer}</div> : null}
      </div>
    </main>
  );
}
