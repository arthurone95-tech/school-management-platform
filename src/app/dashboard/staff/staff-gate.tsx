import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { StaffClient } from "./staff-client";

/**
 * Session-gated half of the staff page.
 *
 * Same gate as the other dashboard pages: reads the request cookies, so it
 * renders inside the page's `<Suspense>` boundary. This is a user-experience
 * gate only; the APIs repeat the checks and Row Level Security is the boundary.
 */
export async function StaffGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [
    canManageMembers,
    canViewClasses,
    canViewSubjects,
    canViewStudents,
    canViewAcademic,
  ] = await Promise.all([
    context.hasPermission("member.manage"),
    context.hasPermission("class.read"),
    context.hasPermission("subject.read"),
    context.hasPermission("learner.read"),
    context.hasPermission("academic.read"),
  ]);

  return (
    <StaffClient
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canManageMembers={canManageMembers}
      canViewClasses={canViewClasses}
      canViewSubjects={canViewSubjects}
      canViewStudents={canViewStudents}
      canViewAcademic={canViewAcademic}
    />
  );
}
