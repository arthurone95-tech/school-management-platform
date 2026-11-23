import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { EventsClient } from "./events-client";

export async function EventsGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [canReadAcademic, canManageAcademic] = await Promise.all([
    context.hasPermission("academic.read"),
    context.hasPermission("academic.manage"),
  ]);

  if (!canReadAcademic && !canManageAcademic) {
    redirect("/dashboard");
  }

  return (
    <EventsClient
      canReadAcademic={canReadAcademic}
      canManageAcademic={canManageAcademic}
    />
  );
}
