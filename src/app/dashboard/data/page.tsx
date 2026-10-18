import type { Metadata } from "next";
import { Suspense } from "react";

import { DataGate } from "./data-gate";

export const metadata: Metadata = {
  title: "Import and export | School Management Platform",
  description: "Import an existing class list, and export school data as CSV.",
};

/**
 * Import and export shell (D-032). A prerenderable shell; the session-dependent
 * part streams in behind `<Suspense>`, matching the other dashboard pages.
 */

function DataLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading import and export…
      </p>
    </div>
  );
}

export default function DataPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<DataLoading />}>
        <DataGate />
      </Suspense>
    </main>
  );
}
