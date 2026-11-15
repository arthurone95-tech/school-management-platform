import type { Metadata } from "next";

import { OwnerClient } from "./owner-client";

export const metadata: Metadata = {
  title: "Platform owner | School Management Platform",
};

/**
 * Platform-owner shell.
 *
 * Server-rendered shell that renders an honest placeholder until a
 * server-enforced platform-owner access model exists.
 */
export default function OwnerPage() {
  return <OwnerClient />;
}
