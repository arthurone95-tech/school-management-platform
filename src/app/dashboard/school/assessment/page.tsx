import type { Metadata } from "next";
import { Suspense } from "react";

import { AssessmentGate } from "./assessment-gate";

export const metadata: Metadata = {
  title: "Custom assessment framework | School Management Platform",
};

/**
 * Dedicated page for the Fully custom assessment framework. It is a
 * prerenderable shell; the session-dependent part streams in behind
 * `<Suspense>`.
 */

function AssessmentLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading the custom assessment framework…
      </p>
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<AssessmentLoading />}>
        <AssessmentGate />
      </Suspense>
    </main>
  );
}
