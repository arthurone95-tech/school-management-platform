import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AttendanceClient } from "./attendance-client";

/**
 * Session-gated half of the attendance page (D-030).
 *
 * Same gate as the other dashboard pages: it reads the request cookies, so it
 * renders inside the page's `<Suspense>` boundary. This is a user-experience gate
 * only. The API routes repeat the identity, school and permission checks, and the
 * `can_access_class` policy is the boundary that actually holds.
 *
 * Two capabilities are read here so the interface can show the right controls:
 *
 *   * `attendance.record` — take and submit a register.
 *   * `attendance.report` — the administrator-only per-class report, and also
 *     what allows correcting a register older than today.
 */
export async function AttendanceGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [canTakeAttendance, canViewReport] = await Promise.all([
    context.hasPermission("attendance.record"),
    context.hasPermission("attendance.report"),
  ]);

  if (!canTakeAttendance && !canViewReport) {
    // Nobody with these permissions lands here, so this is the same refusal the
    // API would give, rendered as a redirect rather than an empty page.
    redirect("/dashboard");
  }

  return (
    <AttendanceClient
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canTakeAttendance={canTakeAttendance}
      canViewReport={canViewReport}
    />
  );
}
