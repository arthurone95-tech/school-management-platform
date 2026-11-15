import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/ui/auth-shell";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Staff sign-in | School Management Platform",
};

/**
 * Staff sign-in page (D-024).
 *
 * A static, prerenderable shell around the client form. It reads no cookies,
 * so it stays prerenderable under Cache Components; the session is established
 * by the `/api/staff/sign-in` call, not by this page.
 */
export default function SignInPage() {
  return (
    <AuthShell
      title="Staff sign-in"
      description="Sign in with the email address your school administrator invited you with, and the password you chose."
      footer={
        <>
          <Link href="/" className="link">
            Back to home
          </Link>
          {" · "}
          <Link href="/portal/sign-in" className="link">
            Student sign-in
          </Link>
        </>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
