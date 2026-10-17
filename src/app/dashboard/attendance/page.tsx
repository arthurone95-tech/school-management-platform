import type { Metadata } from "next";
import { Suspense } from "react";

import { AttendanceGate } from "./attendance-gate";

export const metadata: Metadata = {
  title: "Attendance | School Management Platform",
  description: "Take and correct class attendance, and review class reports.",
};

/**
 * Attendance shell (D-030). A prerenderable shell; the session-dependent part
 * streams in behind `<Suspense>`, which is what makes an anonymous visitor's
 * redirect a streamed one rather than a bare HTTP redirect — the same shape as
 * the other dashboard pages.
 */

function AttendanceLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading attendance…
      </p>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<AttendanceLoading />}>
        <AttendanceGate />
      </Suspense>
    </main>
  );
}
