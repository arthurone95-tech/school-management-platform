import type { Metadata } from "next";

import { AuthShell } from "@/components/ui/auth-shell";

import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "Accept your invitation | School Management Platform",
};

/**
 * Shareable staff invitation acceptance page (D-025).
 *
 * Reached by a link such as `/join#token=<hex>`. The credential lives in the
 * URL fragment, so it never reaches the server in a request line or an access
 * log; the browser posts it to `/api/staff/invitations/*` in the request body.
 *
 * No session is required: possession of the single-use, expiring link is the
 * credential. The shell is static; the client form owns the state.
 */
export default function JoinPage() {
  return (
    <AuthShell
      title="Accept your invitation"
      description="Set a password to activate your staff account."
    >
      <JoinForm />
    </AuthShell>
  );
}
