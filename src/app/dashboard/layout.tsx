import { SidebarLoader } from "@/components/sidebar-loader";

/**
 * Dashboard shell.
 *
 * The real, permission-aware sidebar is rendered by `SidebarLoader`, which
 * reads the signed-in staff member's context from `/api/staff/context`. The
 * page itself owns the `<main id="main">` element, so the shell only provides
 * the `<div className="app-main">` content column (docs/UI_UX_DOCUMENTATION.md 5).
 */
export default function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <SidebarLoader />
      <div className="app-main">{children}</div>
    </div>
  );
}
