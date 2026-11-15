import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/ui/auth-shell";

import { PortalSignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Student sign-in | School Management Platform",
};

/**
 * Student sign-in page (D-020).
 *
 * Server-rendered shell with a client form, mirroring the staff sign-in page
 * (`src/app/sign-in/page.tsx`). The session is established by
 * `/api/portal/sign-in`, not by this page, so the page stays prerenderable.
 */
export default function PortalSignInPage() {
  return (
    <AuthShell
      brand="Student portal"
      title="Student sign-in"
      description="Enter your school code, username and password to sign in."
      footer={
        <>
          <Link href="/portal/activate" className="link">
            Activate your account
          </Link>
          {" · "}
          <Link href="/sign-in" className="link">
            Staff sign-in
          </Link>
        </>
      }
    >
      <PortalSignInForm />
    </AuthShell>
  );
}
