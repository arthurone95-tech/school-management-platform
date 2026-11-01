"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Settings,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/staff/roles";

export interface SidebarProps {
  readonly schoolName: string | null;
  readonly role: string;
  readonly email: string;
  readonly canManageMembers: boolean;
  readonly canViewStudents: boolean;
  readonly canManageClasses: boolean;
  readonly canViewSettings: boolean;
  readonly canViewAttendance: boolean;
  readonly canViewResults: boolean;
  readonly canViewData: boolean;
}

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly show: boolean;
}

export function Sidebar(props: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("sidebar-collapsed") === "1";
    document.body.classList.toggle("sidebar-collapsed", stored);
    return stored;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      document.body.classList.toggle("sidebar-collapsed", next);
      return next;
    });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/staff/sign-out", { method: "POST" });
    } catch {
      // best effort
    }
    router.replace("/sign-in");
    router.refresh();
  }

  const showAttendance =
    props.canViewAttendance && props.role !== "school_administrator";

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/dashboard/learners", label: "Students", icon: GraduationCap, show: props.canViewStudents },
    { href: "/dashboard/classes", label: "Classes", icon: BookOpen, show: props.canManageClasses },
    { href: "/dashboard/staff", label: "Staff", icon: Users, show: props.canManageMembers },
    { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, show: showAttendance },
    { href: "/dashboard/results", label: "Results", icon: BarChart3, show: props.canViewResults },
    { href: "/dashboard/data", label: "Import / export", icon: Upload, show: props.canViewData },
    { href: "/dashboard/invitations", label: "Invitations", icon: Inbox, show: props.canManageMembers },
    { href: "/dashboard/school", label: "Settings", icon: Settings, show: props.canViewSettings },
  ];

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle navigation"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          <X className="sidebar-mobile-toggle__icon" />
        ) : (
          <Menu className="sidebar-mobile-toggle__icon" />
        )}
      </button>
      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={`sidebar${collapsed ? " sidebar--collapsed" : ""}${
          mobileOpen ? " sidebar--open" : ""
        }`}
        aria-label="Primary navigation"
      >
        <div className="sidebar__top">
          <button
            type="button"
            className="sidebar__toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="sidebar__icon" />
            ) : (
              <PanelLeftClose className="sidebar__icon" />
            )}
          </button>
          {!collapsed ? (
            <div className="sidebar__brand">
              <span className="brand__name">{props.schoolName ?? "Your school"}</span>
              <span className="brand__context">
                {roleLabel(props.role)}
                {props.email ? ` · ${props.email}` : ""}
              </span>
            </div>
          ) : null}
        </div>
        <nav className="sidebar__nav">
          {items
            .filter((item) => item.show)
            .map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar__link${active ? " sidebar__link--active" : ""}`}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="sidebar__icon" />
                  {!collapsed ? (
                    <span className="sidebar__label">{item.label}</span>
                  ) : (
                    <span className="sidebar__tooltip" role="tooltip">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>
        <div className="sidebar__footer">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSignOut}
            loading={signingOut}
            title="Sign out"
          >
            <LogOut className="sidebar__icon" />
            {!collapsed ? (signingOut ? "Signing out…" : "Sign out") : null}
          </Button>
        </div>
      </aside>
    </>
  );
}