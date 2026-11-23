import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { utcDaysAgo, utcToday } from "@/lib/dates";
import { listAssessments } from "@/lib/server/academics";
import {
  listAttendanceClasses,
  listClassSubjects,
  listSessions,
} from "@/lib/server/attendance";
import { getAssessmentMode } from "@/lib/server/assessment-mode";
import { loadDashboardOverview } from "@/lib/server/dashboard-overview";
import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { DashboardClient, type DashboardMetrics } from "./dashboard-client";
import {
  TeacherDashboard,
  type TeacherAssessmentSummary,
  type TeacherDashboardData,
  type TeacherSessionSummary,
  type TeacherSubjectSummary,
} from "./teacher-dashboard";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Loads only what a teacher is allowed to see.
 *
 * All four helpers run on the caller's own session client. Class and subject
 * discovery goes through the gated `accessible_classes` / `class_subjects`
 * functions because a teacher deliberately has no `class.read` or `subject.read`
 * (D-030); assessments and registers are additionally limited by RLS through
 * `can_access_class`. Nothing here reads the whole-school counts used by the
 * administrator home screen, and no learner personal data is fetched.
 */
async function loadTeacherData(
  supabase: ServerClient,
  schoolId: string,
): Promise<TeacherDashboardData> {
  const today = utcToday();
  const [classes, assessments, sessions, mode] = await Promise.all([
    listAttendanceClasses(supabase, schoolId),
    listAssessments({
      supabase,
      schoolId,
      classId: null,
      includeInactive: false,
      framework: "custom",
    }),
    listSessions({
      supabase,
      schoolId,
      sessionDate: today,
      classId: null,
      canCorrectAnyDate: false,
      today,
    }),
    getAssessmentMode(supabase, schoolId),
  ]);

  const subjectLists = await Promise.all(
    (classes ?? []).map((klass) =>
      listClassSubjects(supabase, schoolId, klass.id),
    ),
  );

  const subjects = new Map<string, TeacherSubjectSummary>();
  for (const list of subjectLists) {
    for (const subject of list ?? []) {
      if (!subjects.has(subject.id)) {
        subjects.set(subject.id, {
          id: subject.id,
          name: subject.name,
          code: subject.code,
        });
      }
    }
  }

  const assessmentSummaries: TeacherAssessmentSummary[] = (assessments ?? [])
    .slice(0, 5)
    .map((assessment) => ({
      id: assessment.id,
      name: assessment.name,
      className: assessment.className,
      subjectName: assessment.subjectName,
      assessedOn: assessment.assessedOn,
      markedCount: assessment.markedCount,
      learnerCount: assessment.learnerCount,
      pendingCount: Math.max(
        0,
        assessment.learnerCount - assessment.markedCount,
      ),
      isActive: assessment.isActive,
    }));

  const sessionSummaries: TeacherSessionSummary[] = (sessions ?? []).map(
    (session) => ({
      id: session.id,
      className: session.className,
      subjectName: session.subjectName,
      sessionDate: session.sessionDate,
      recordedCount: session.recordedCount,
      isCorrectable: session.isCorrectable,
    }),
  );

  const incomplete =
    classes === null ||
    assessments === null ||
    sessions === null ||
    mode === null ||
    subjectLists.some((list) => list === null);

  return {
    classes: classes ?? [],
    subjects: [...subjects.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    assessments: assessmentSummaries,
    sessions: sessionSummaries,
    assessmentMode: mode,
    // A teacher has no `academic.read`, so the academic-year table is not a
    // permitted source for a term label here. The screen uses a neutral
    // description instead of showing a guessed term.
    activeTerm: null,
    loadError: incomplete
      ? "Some dashboard information could not be loaded."
      : null,
  };
}

export async function DashboardGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const schoolId = context.schoolId;

  if (context.role === "teacher") {
    return (
      <TeacherDashboard
        schoolName={context.schoolName}
        data={await loadTeacherData(supabase, schoolId)}
      />
    );
  }

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

  const overview = await loadDashboardOverview(supabase, schoolId);

  return (
    <DashboardClient
      schoolName={context.schoolName}
      metrics={metrics}
      overview={overview}
    />
  );
}
