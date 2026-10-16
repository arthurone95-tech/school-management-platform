import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ClassesClient } from "./classes-client";

/**
 * Session-gated half of the classes page.
 *
 * Same gate as the other dashboard pages: reads the request cookies, so it
 * renders inside the page's `<Suspense>` boundary. `connection()` keeps the
 * session lookup and the clock reads inside the auth client out of the
 * prerender pass.
 */
export async function ClassesGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [canRead, canManage, canViewStudents] = await Promise.all([
    context.hasPermission("class.read"),
    context.hasPermission("class.manage"),
    context.hasPermission("learner.read"),
  ]);

  return (
    <ClassesClient
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canRead={canRead}
      canManage={canManage}
      canViewStudents={canViewStudents}
    />
  );
}
