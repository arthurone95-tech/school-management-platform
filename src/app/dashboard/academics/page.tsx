import type { Metadata } from "next";
import { Suspense } from "react";

import { AcademicsGate } from "./academics-gate";

export const metadata: Metadata = {
  title: "Academics | School Management Platform",
};

function AcademicsLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading academics workspace…
      </p>
    </div>
  );
}

export default function AcademicsPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<AcademicsLoading />}>
        <AcademicsGate />
      </Suspense>
    </main>
  );
}
