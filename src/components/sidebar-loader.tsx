"use client";

import { useEffect, useState } from "react";

import { Sidebar, type SidebarProps } from "@/components/sidebar";

export function SidebarLoader() {
  const [props, setProps] = useState<SidebarProps | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/staff/context", { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok) return;
        setProps({
          schoolName: data.schoolName ?? null,
          role: data.role,
          email: data.email ?? "",
          canManageMembers: !!data.canManageMembers,
          canViewStudents: !!data.canViewStudents,
          canManageClasses: !!data.canManageClasses,
          canViewSettings: !!data.canViewSettings,
          canViewAttendance: !!data.canViewAttendance,
          canViewResults: !!data.canViewResults,
          canViewData: !!data.canViewData,
        });
      })
      .catch(() => {
        // Leave sidebar hidden until context resolves.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!props) return null;
  return <Sidebar {...props} />;
}