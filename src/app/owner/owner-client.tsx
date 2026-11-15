"use client";

import { Alert } from "@/components/ui/alert";

/**
 * Honest placeholder for the platform-owner console.
 *
 * The previous version checked the owner flag in the browser only, imported a
 * server-only Supabase module into client code, used `alert()` for errors and
 * reloaded the page after creating a school through an endpoint that has no
 * server-side authorization. All of that is unresolved and is reported
 * separately (see AGENTS.md 4 and 5), so this screen shows no data and offers no
 * privileged action until the approach is approved.
 */
export function OwnerClient() {
  return (
    <div className="stack">
      <h1>Platform owner</h1>

      <Alert variant="info">This page is not available yet.</Alert>

      <p className="muted">
        Platform administration is not enabled in this build. Creating schools
        and viewing the school list will be available once the platform-owner
        access model is approved and enforced on the server.
      </p>
    </div>
  );
}
