import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardGate } from "./dashboard-gate";

export const metadata: Metadata = {
  title: "Staff dashboard | School Management Platform",
};

/**
 * Staff dashboard shell (D-024 Phase 2 slice).
 *
 * The page itself is a prerenderable shell; the part that reads the session
 * streams in behind the `<Suspense>` boundary, as required when Cache
 * Components is enabled (Next.js `authentication-with-cache-components` guide).
 * That keeps an uncached `cookies()` read out of the static shell.
 */

function DashboardLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading your school dashboard…
      </p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<DashboardLoading />}>
        <DashboardGate />
      </Suspense>
    </main>
  );
}
