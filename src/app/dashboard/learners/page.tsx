import type { Metadata } from "next";
import { Suspense } from "react";

import { LearnersGate } from "./learners-gate";

export const metadata: Metadata = {
  title: "Students | School Management Platform",
};

/**
 * Students (enrolment and class placement) shell — the first end-to-end school
 * workflow, D-018. The page is a prerenderable shell; the session-dependent part
 * streams in behind `<Suspense>` (Next.js Cache Components), so the uncached
 * cookie read never reaches the static output.
 */

function LearnersLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading your students…
      </p>
    </div>
  );
}

export default function LearnersPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<LearnersLoading />}>
        <LearnersGate />
      </Suspense>
    </main>
  );
}
