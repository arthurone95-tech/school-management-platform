import { SidebarLoader } from "@/components/sidebar-loader";

export default function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <SidebarLoader />
      <main className="app-main">{children}</main>
    </div>
  );
}