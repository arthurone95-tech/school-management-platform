import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = {
  title: "Platform owner | School Management Platform",
};

/**
 * Platform-owner console.
 *
 * Honest placeholder until a server-enforced platform-owner access model
 * exists. The earlier version checked the owner flag in the browser only,
 * imported a server-only Supabase module into client code, used `alert()` for
 * errors and reloaded the page after creating a school through an endpoint with
 * no server-side authorization. That is unresolved and is reported separately
 * (see AGENTS.md 4 and 5), so this screen shows no data and offers no
 * privileged action.
 */
export default function OwnerPage() {
  return (
    <StatusPage title="Platform owner">
      <Alert variant="info" role={null}>
        This page is not available yet.
      </Alert>

      <p className="muted">
        Platform administration is not enabled in this build. Creating schools
        and viewing the school list will be available once the platform-owner
        access model is approved and enforced on the server.
      </p>
    </StatusPage>
  );
}
