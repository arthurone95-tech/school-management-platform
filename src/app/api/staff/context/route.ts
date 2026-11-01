import { NextResponse } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    return json({ ok: false, error: "Not signed in." }, 401);
  }

  const [
    canManageMembers,
    canViewStudents,
    canManageClasses,
    canViewSettings,
    canViewAttendance,
    canViewResults,
    canViewData,
  ] = await Promise.all([
    context.hasPermission("member.manage"),
    context.hasPermission("learner.read"),
    context.hasPermission("class.manage"),
    (async () =>
      (await context.hasPermission("school.manage")) ||
      (await context.hasPermission("academic.read")) ||
      (await context.hasPermission("subject.read")))(),
    context
      .hasPermission("attendance.record")
      .then(async (r) => r || (await context.hasPermission("attendance.read"))),
    context
      .hasPermission("assessment.read")
      .then(async (r) => r || (await context.hasPermission("report.read"))),
    (async () =>
      (await context.hasPermission("learner.import")) ||
      (await context.hasPermission("learner.export")) ||
      (await context.hasPermission("report.export")))(),
  ]);

  return json({
    ok: true,
    schoolName: context.schoolName,
    role: context.role,
    email: context.email,
    canManageMembers,
    canViewStudents,
    canManageClasses,
    canViewSettings,
    canViewAttendance,
    canViewResults,
    canViewData,
  });
}