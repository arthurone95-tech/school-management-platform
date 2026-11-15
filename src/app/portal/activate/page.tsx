import type { Metadata } from "next";

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
  return <ActivateForm />;
}
