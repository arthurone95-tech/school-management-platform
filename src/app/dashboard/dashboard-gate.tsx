import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { DashboardClient } from "./dashboard-client";

/**
 * Session-gated half of the dashboard.
 *
 * It reads the request cookies, so it must render inside the page's `<Suspense>`
 * boundary. Anyone without an active staff membership is redirected to sign-in.
 * This is a user-experience gate only: the invitation APIs repeat the same
 * identity, school and permission checks server-side, and those are the actual
 * authorization boundary.
 *
 * `connection()` stops prerendering at this point so the whole gate — including
 * the session lookup and the clock reads inside the auth client — runs only at
 * request time. Without it, Next.js still walks this subtree during the
 * prerender pass and reports the unstable time value
 * (`blocking-prerender-current-time`) even though the output is correctly
 * deferred behind `<Suspense>`.
 */
export async function DashboardGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [
    canManageMembers,
    canViewStudents,
    canManageClasses,
    canManageSchool,
    canReadAcademic,
    canReadSubjects,
    canRecordAttendance,
    canReadAttendance,
  ] = await Promise.all([
    context.hasPermission("member.manage"),
    context.hasPermission("learner.read"),
    context.hasPermission("class.manage"),
    context.hasPermission("school.manage"),
    context.hasPermission("academic.read"),
    context.hasPermission("subject.read"),
    context.hasPermission("attendance.record"),
    context.hasPermission("attendance.read"),
  ]);

  // The school settings page reveals whatever each permission allows; the nav
  // shows the link only when there is something there for this caller to see
  // (D-029).
  const canViewSettings = canManageSchool || canReadAcademic || canReadSubjects;

  // Attendance is the first page a teacher has any access to, so the nav links
  // it on `attendance.record` or `attendance.read` rather than on
  // `attendance.report`, which is administrator-only (D-030).
  const canViewAttendance = canRecordAttendance || canReadAttendance;

  return (
    <DashboardClient
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canManageMembers={canManageMembers}
      canViewStudents={canViewStudents}
      canManageClasses={canManageClasses}
      canViewSettings={canViewSettings}
      canViewAttendance={canViewAttendance}
    />
  );
}
