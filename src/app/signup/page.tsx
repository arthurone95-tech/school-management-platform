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
 * New schools use this page to create an account and get started with
 * the School Management Platform. After signing up, schools receive a
 * unique code and can invite staff and administrators.
 *
 * The form submits to the backend which creates:
 *   1. A school row in the schools table
 *   2. An administrator Auth account (verified, with password)
 *   3. A school_members entry linking the user to the school
 *   4. Default grade bands for the school
 *
 * On success the user is redirected to the sign-in page with the
 * school code preserved in the query string.
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