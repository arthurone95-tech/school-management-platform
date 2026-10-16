import type { Metadata } from "next";
import { Suspense } from "react";

import { ClassesGate } from "./classes-gate";

export const metadata: Metadata = {
  title: "Classes | School Management Platform",
};

/**
 * Classes shell (D-028). Like the other dashboard pages it is a prerenderable
 * shell; the session-dependent part streams in behind `<Suspense>` (Next.js
 * Cache Components), so the uncached cookie read never reaches the static
 * output.
 */

function ClassesLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading your classes…
      </p>
    </div>
  );
}

export default function ClassesPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<ClassesLoading />}>
        <ClassesGate />
      </Suspense>
    </main>
  );
}
