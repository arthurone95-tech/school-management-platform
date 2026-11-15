"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Teacher sidebar navigation.
 *
 * Reduced menu: Home, My classes, Attendance, Results.
 * Nothing the teacher cannot use should appear.
 *
 * Uses Next.js useRouter for navigation instead of window.location
 * to satisfy ESLint rules.
 */
export function TeacherSidebar() {
  const router = useRouter();

  useEffect(() => {
    // Ensure teacher-only URLs are redirected to dashboard
    const handleHashChange = () => {
      const path = window.location.pathname;
      if (
        path === "/dashboard/invitations" ||
        path === "/dashboard/staff/invitations"
      ) {
        router.push("/dashboard");
      }
      if (
        path === "/dashboard/import-export" ||
        path === "/dashboard/import"
      ) {
        router.push("/dashboard");
      }
    };

    // Initial check
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [router]);

  return (
    <nav className="border-right border-border flex flex-col h-screen p-4">
      <ul className="space-y-2">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/5"
          >
            Home
          </Link>
        </li>

        <li>
          <Link
            href="/dashboard/classes"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/5"
          >
            My classes
          </Link>
        </li>

        <li>
          <Link
            href="/dashboard/attendance"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/5"
          >
            Attendance
          </Link>
        </li>

        <li>
          <Link
            href="/dashboard/results"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/5"
          >
            Results
          </Link>
        </li>
      </ul>
    </nav>
  );
}