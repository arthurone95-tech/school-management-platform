import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/ui/auth-shell";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your school | School Management Platform",
};

/**
 * School sign-up page.
 *
 * School self-service sign-up has no server-enforced, school-scoped creation
 * path yet (see the platform-owner note in `src/app/owner/page.tsx`), so the
 * form is presented for layout only and cannot be submitted. This page reads no
 * cookies and stays prerenderable.
 */
export default function SignupPage() {
  return (
    <AuthShell
      title="Create your school account"
      description="Set up your school on the platform. Once your account is ready you can add classes, invite staff, and track attendance and results."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
