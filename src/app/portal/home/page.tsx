import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = {
  title: "Student home | School Management Platform",
};

/**
 * Student home (D-020).
 *
 * Honest placeholder until the authorised, school-scoped data path for a
 * student's own results and attendance exists. The earlier version read that
 * data from `app_metadata` in the browser using a server-only module; it was
 * removed rather than showing invented data.
 */
export default function PortalHomePage() {
  return (
    <StatusPage title="Student home">
      <Alert variant="info" role={null}>
        This page is not available yet.
      </Alert>

      <p className="muted">
        The student portal home is still being built. When it is ready, you will
        see your classes, attendance and published results here after signing in.
      </p>

      <p className="muted">
        <Link href="/portal/sign-in" className="link">
          Go to student sign-in
        </Link>
      </p>
    </StatusPage>
  );
}
