"use client";

import Link from "next/link";

import { Alert } from "@/components/ui/alert";

/**
 * Honest placeholder for the student home (D-020).
 *
 * The real screen must read the signed-in student's own results and attendance
 * from authorised, school-scoped server queries. That data path does not exist
 * yet, and the previous version read it from `app_metadata` in the browser
 * using a server-only module. Until the data path is decided, this page says so
 * plainly rather than showing invented data.
 */
export function HomePlaceholder() {
  return (
    <div className="stack">
      <h1>Student home</h1>

      <Alert variant="info">This page is not available yet.</Alert>

      <p className="muted">
        The student portal home is still being built. When it is ready, you will
        see your classes, attendance and published results here after signing in.
      </p>

      <p className="muted">
        <Link href="/portal/sign-in" className="link">
          Go to student sign-in
        </Link>
      </p>
    </div>
  );
}
