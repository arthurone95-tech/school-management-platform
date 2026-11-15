import type { Metadata } from "next";

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
  return <PortalSignInForm />;
}
