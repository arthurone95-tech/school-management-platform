import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { LearnersClient } from "./learners-client";

/**
 * Session-gated half of the students page.
 *
 * Same gate as the dashboard: reads the request cookies, so it renders inside
 * the page's `<Suspense>` boundary. `connection()` keeps the session lookup and
 * the clock reads inside the auth client out of the prerender pass.
 */
export async function LearnersGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [canRead, canEnrol, canCorrect, canChangePlacement, canManageClasses] =
    await Promise.all([
      context.hasPermission("learner.read"),
      context.hasPermission("learner.create"),
      context.hasPermission("learner.update"),
      context.hasPermission("learner.placement.manage"),
      context.hasPermission("class.manage"),
    ]);

  return (
    <LearnersClient
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canRead={canRead}
      canEnrol={canEnrol}
      canCorrect={canCorrect}
      canChangePlacement={canChangePlacement}
      canManageClasses={canManageClasses}
    />
  );
}
