import type { Metadata } from "next";
import { Suspense } from "react";

import { SchoolGate } from "./school-gate";

export const metadata: Metadata = {
  title: "School settings | School Management Platform",
};

/**
 * School settings shell (D-029). Like the other dashboard pages it is a
 * prerenderable shell; the session-dependent part streams in behind
 * `<Suspense>`, so the uncached cookie read never reaches the static output.
 */

function SchoolLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading school settings…
      </p>
    </div>
  );
}

export default function SchoolPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<SchoolLoading />}>
        <SchoolGate />
      </Suspense>
    </main>
  );
}
