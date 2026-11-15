import { AdminSidebar } from "@/app/dashboard/admin/sidebar";

export default function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <AdminSidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}