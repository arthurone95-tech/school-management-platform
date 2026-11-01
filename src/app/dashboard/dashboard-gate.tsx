import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { utcDaysAgo, utcToday } from "@/lib/dates";
import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { DashboardClient, type DashboardMetrics } from "./dashboard-client";

export async function DashboardGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const schoolId = context.schoolId;

  const [
    { count: totalStudents },
    { count: totalTeachers },
    { count: totalClasses },
    { data: currentYear },
  ] = await Promise.all([
    supabase
      .from("learners")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("school_members")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .eq("status", "active"),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_active", true),
    supabase
      .from("academic_years")
      .select("id, name, terms ( id, name, starts_on, ends_on )")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  const today = utcToday();
  let activeTerm: string | null = null;
  if (currentYear) {
    const terms = (currentYear.terms ?? []) as {
      name: string;
      starts_on: string;
      ends_on: string;
    }[];
    const current = terms.find(
      (t) => t.starts_on <= today && today <= t.ends_on,
    );
    activeTerm = current
      ? `${current.name} (${currentYear.name as string})`
      : terms.length > 0
        ? `${terms[0].name} (${currentYear.name as string})`
        : (currentYear.name as string);
  }

  const sevenDaysAgo = utcDaysAgo(7);
  const { count: recentActivityCount } = await supabase
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .gte("created_at", sevenDaysAgo);

  const metrics: DashboardMetrics = {
    totalStudents: totalStudents ?? 0,
    totalTeachers: totalTeachers ?? 0,
    totalClasses: totalClasses ?? 0,
    activeTerm,
    recentActivityCount: recentActivityCount ?? 0,
  };

  return <DashboardClient schoolName={context.schoolName} metrics={metrics} />;
}