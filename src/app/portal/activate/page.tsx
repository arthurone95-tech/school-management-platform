import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/ui/auth-shell";

import { ActivateForm } from "./activate-form";

export const metadata: Metadata = {
  title: "Student activation | School Management Platform",
};

/**
 * Student activation page (D-019, D-020).
 *
 * Server-rendered shell with a client form. The credential is claimed and the
 * password is set by `/api/portal/activate`, not by this page.
 */
export default function PortalActivatePage() {
  return (
    <AuthShell
      brand="Student portal"
      title="Student activation"
      description="Enter your one-time activation code and choose a password."
      footer={
        <>
          Already activated?{" "}
          <Link href="/portal/sign-in" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <ActivateForm />
    </AuthShell>
  );
}
