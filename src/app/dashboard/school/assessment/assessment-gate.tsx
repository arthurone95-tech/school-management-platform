import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AssessmentClient } from "./assessment-client";

/**
 * Session-gated half of the custom assessment framework page.
 *
 * Same pattern as the other dashboard gates: the session lookup runs inside the
 * page's `<Suspense>` boundary after `connection()`. This is a user-experience
 * gate only; the APIs repeat the checks and RLS is the real boundary.
 */
export async function AssessmentGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [canReadSubjects, canManageSubjects, canReadGrading, canManageGrading] =
    await Promise.all([
      context.hasPermission("subject.read"),
      context.hasPermission("subject.manage"),
      context.hasPermission("grade.read"),
      context.hasPermission("grade.manage"),
    ]);

  return (
    <AssessmentClient
      canReadSubjects={canReadSubjects}
      canManageSubjects={canManageSubjects}
      canReadGrading={canReadGrading}
      canManageGrading={canManageGrading}
    />
  );
}
