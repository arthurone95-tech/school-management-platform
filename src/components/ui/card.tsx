import type { ReactNode } from "react";

/** A bordered surface that groups one task (docs/UI_UX_DOCUMENTATION.md 10). */
export function Card({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={["card", className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="card__header">
      <div>
        <h2 className="card__title">{title}</h2>
        {description ? (
          <p className="card__description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="cluster">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={["card__body", className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
