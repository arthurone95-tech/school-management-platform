import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusPage } from "@/components/ui/status-page";
import { Compass } from "lucide-react";

/**
 * Consistent not-found page for unknown routes (docs/UI_UX_DOCUMENTATION.md 6).
 *
 * Mirrors the rest of the app: flat, centred, one clear action back to the
 * home page. Never leaks internal route structure.
 */
export default function NotFound() {
  return (
    <StatusPage title="Page not found">
      <EmptyState
        icon={<Compass />}
        title="This page doesn’t exist"
        description="Check the web address or return to the home page."
        actions={
          <Link href="/" className="btn btn--primary">
            Go to home
          </Link>
        }
      />
    </StatusPage>
  );
}
