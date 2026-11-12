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
 *
 * Visual: centred card on the page background, product name above the form,
 * a link back to the home page beneath the form, and a note that students
 * will have their own sign-in soon.
 */
export default function SignInPage() {
  return (
    <main className="page" id="main">
      <div className="min-h-screen bg-background">
        {/* Product name banner */}
        <header className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="font-medium text-foreground hover:underline"
              >
                School Management Platform
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="text-xs text-muted-foreground"
                  title="Back to home"
                >
                  ← Home
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-screen flex-col items-center py-12">
          <div className="container container--narrow">
            <div className="stack stack--sm">
              <h1>Staff sign-in</h1>
              <p className="muted">
                Sign in with the email address your school administrator invited you
                with, and the password you chose.
              </p>

              <SignInForm />

              <p className="mt-4 muted">
                This sign-in is for staff and administrators. Students will have
                their own sign-in soon.
              </p>

              <p className="mt-4 text-sm muted">
                <Link href="/">Back to home</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}