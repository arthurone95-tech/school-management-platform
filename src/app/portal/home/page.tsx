import type { Metadata } from "next";

import { HomePlaceholder } from "./home-placeholder";

export const metadata: Metadata = {
  title: "Student home | School Management Platform",
};

/**
 * Student home shell (D-020).
 *
 * Server-rendered shell that renders an honest placeholder until the
 * authorised, school-scoped data path for a student's own records exists.
 */
export default function PortalHomePage() {
  return <HomePlaceholder />;
}
