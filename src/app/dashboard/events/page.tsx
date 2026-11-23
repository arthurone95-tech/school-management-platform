import type { Metadata } from "next";
import { Suspense } from "react";

import { EventsGate } from "./events-gate";

export const metadata: Metadata = {
  title: "Events and calendar | School Management Platform",
};

function EventsLoading() {
  return (
    <div className="container stack" aria-busy="true">
      <p className="muted" role="status">
        Loading events and calendar…
      </p>
    </div>
  );
}

export default function EventsPage() {
  return (
    <main className="page" id="main">
      <Suspense fallback={<EventsLoading />}>
        <EventsGate />
      </Suspense>
    </main>
  );
}
