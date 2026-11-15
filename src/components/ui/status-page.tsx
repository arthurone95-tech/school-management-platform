import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";

/**
 * Simple full-page shell for standalone messages (placeholders, and later
 * not-found and error screens). It owns the page's `<main id="main">` and the
 * single `<h1>`, and keeps the same width and spacing as the other pages
 * (docs/UI_UX_DOCUMENTATION.md 5 and 10).
 */
export function StatusPage({
  title,
  description,
  children,
}: {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <main className="page" id="main">
      <div className="container container--narrow">
        <div className="stack">
          <PageHeader title={title} description={description} />
          {children}
        </div>
      </div>
    </main>
  );
}
