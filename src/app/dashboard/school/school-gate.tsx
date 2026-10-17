import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SchoolClient } from "./school-client";

/**
 * Session-gated half of the school settings page.
 *
 * Same gate as the other dashboard pages: reads the request cookies, so it
 * renders inside the page's `<Suspense>` boundary. `connection()` keeps the
 * session lookup and the clock reads inside the auth client out of the prerender
 * pass. This is a user-experience gate only; the APIs repeat the checks and Row
 * Level Security is the real boundary.
 */
export async function SchoolGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [
    canManageSchool,
    canReadAcademic,
    canManageAcademic,
    canReadSubjects,
    canManageSubjects,
    canViewClasses,
    canViewStudents,
    canViewStaff,
  ] = await Promise.all([
    context.hasPermission("school.manage"),
    context.hasPermission("academic.read"),
    context.hasPermission("academic.manage"),
    context.hasPermission("subject.read"),
    context.hasPermission("subject.manage"),
    context.hasPermission("class.read"),
    context.hasPermission("learner.read"),
    context.hasPermission("member.manage"),
  ]);

  return (
    <SchoolClient
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canManageSchool={canManageSchool}
      canReadAcademic={canReadAcademic}
      canManageAcademic={canManageAcademic}
      canReadSubjects={canReadSubjects}
      canManageSubjects={canManageSubjects}
      canViewClasses={canViewClasses}
      canViewStudents={canViewStudents}
      canViewStaff={canViewStaff}
    />
  );
}
