import type { Metadata } from "next";
import { Suspense } from "react";

import { ResultsGate } from "./results-gate";

export const metadata: Metadata = {
  title: "Results | School Management Platform",
  description: "Set assessments, record marks, and review a class summary.",
};

/**
 * Results shell (D-031). A prerenderable shell; the session-dependent part
 * streams in behind `<Suspense>`, which is what makes an anonymous visitor's
 * redirect a streamed one rather than a bare HTTP redirect — the same shape as
 * the other dashboard pages.
 */

function ResultsLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading results…
      </p>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<ResultsLoading />}>
        <ResultsGate />
      </Suspense>
    </main>
  );
}
