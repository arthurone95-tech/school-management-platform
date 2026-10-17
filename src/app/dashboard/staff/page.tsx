import type { Metadata } from "next";
import { Suspense } from "react";

import { StaffGate } from "./staff-gate";

export const metadata: Metadata = {
  title: "Staff | School Management Platform",
};

/**
 * Staff shell (D-029). A prerenderable shell; the session-dependent part
 * streams in behind `<Suspense>`.
 */

function StaffLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading your staff…
      </p>
    </div>
  );
}

export default function StaffPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<StaffLoading />}>
        <StaffGate />
      </Suspense>
    </main>
  );
}
