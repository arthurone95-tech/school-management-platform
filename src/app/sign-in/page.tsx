import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Staff sign-in | School Management Platform",
};

/**
 * Staff sign-in page (D-024 Phase 2 slice).
 *
 * Server-rendered shell with a static client form. It reads no cookies, so it
 * stays prerenderable under Cache Components; the session is established by the
 * `/api/staff/sign-in` call, not by this page.
 */
export default function SignInPage() {
  return (
    <main className="page" id="main">
      <div className="container container--narrow stack">
        <div className="stack stack--sm">
          <h1>Staff sign-in</h1>
          <p className="muted">
            Sign in with the email address your school administrator invited you
            with, and the password you chose.
          </p>
        </div>

        <SignInForm />

        <p className="muted">
          Have an invitation link? Open it to set your password first, then sign
          in here.{" "}
          <Link className="link" href="/">
            Back to home
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
