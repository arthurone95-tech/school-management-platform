import "server-only";

import { utcToday } from "@/lib/dates";
import type {
  DashboardOverview,
  OverviewAssessment,
  OverviewClassCount,
  OverviewEvent,
  OverviewExam,
} from "@/lib/staff/dashboard-overview";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import { listAcademicEvents } from "./academics-events";
import { listExamSchedules } from "./academics-exams";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Whole-school figures for the administrator home screen.
 *
 * Every query is scoped to the school resolved from the signed-in user's
 * membership and runs on that user's session client. RLS applies the same
 * permission checks as the existing learner, class, academic and assessment
 * screens, so this loader cannot be pointed at another school or used by a
 * teacher. It returns counts and labels only — no learner personal records.
 */
export async function loadDashboardOverview(
  supabase: ServerClient,
  schoolId: string,
): Promise<DashboardOverview> {
  const today = utcToday();

  const [learnerResult, classResult, placementResult, events, exams, assessmentResult] =
    await Promise.all([
      supabase
        .from("learners")
        .select("gender, status")
        .eq("school_id", schoolId),
      supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("learner_class_placements")
        .select("class_id")
        .eq("school_id", schoolId)
        .is("ended_at", null),
      listAcademicEvents(supabase, schoolId, null),
      listExamSchedules(supabase, schoolId, null),
      supabase
        .from("assessments")
        .select("id, name, assessed_on, classes ( name )")
        .eq("school_id", schoolId)
        .eq("framework", "custom")
        .eq("is_active", true)
        .gte("assessed_on", today)
        .order("assessed_on", { ascending: true })
        .limit(5),
    ]);

  const learnerRows = learnerResult.error
    ? null
    : (learnerResult.data as { gender: string; status: string }[] | null);
  const classRows = classResult.error
    ? null
    : (classResult.data as { id: string; name: string }[] | null);
  const placementRows = placementResult.error
    ? null
    : (placementResult.data as { class_id: string }[] | null);

  let maleLearners = 0;
  let femaleLearners = 0;
  let otherLearners = 0;
  let activeLearners = 0;
  let inactiveLearners = 0;
  for (const learner of learnerRows ?? []) {
    if (learner.gender === "male") {
      maleLearners += 1;
    } else if (learner.gender === "female") {
      femaleLearners += 1;
    } else {
      otherLearners += 1;
    }
    if (learner.status === "active") {
      activeLearners += 1;
    } else {
      inactiveLearners += 1;
    }
  }

  const placementCounts = new Map<string, number>();
  for (const placement of placementRows ?? []) {
    placementCounts.set(
      placement.class_id,
      (placementCounts.get(placement.class_id) ?? 0) + 1,
    );
  }
  const enrolmentByClass: OverviewClassCount[] = (classRows ?? []).map(
    (klass) => ({
      classId: klass.id,
      className: klass.name,
      count: placementCounts.get(klass.id) ?? 0,
    }),
  );

  const upcomingEvents: OverviewEvent[] = (events ?? [])
    .filter((event) => event.startsOn >= today)
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
    }));

  const upcomingExams: OverviewExam[] = (exams ?? [])
    .filter((exam) => exam.startsOn >= today)
    .slice(0, 5)
    .map((exam) => ({
      id: exam.id,
      name: exam.name,
      startsOn: exam.startsOn,
      endsOn: exam.endsOn,
      status: exam.status,
    }));

  const assessmentRows = assessmentResult.error
    ? null
    : (assessmentResult.data as
        | {
            id: string;
            name: string;
            assessed_on: string;
            classes: { name: string }[] | null;
          }[]
        | null);
  const upcomingAssessments: OverviewAssessment[] = (assessmentRows ?? []).map(
    (assessment) => ({
      id: assessment.id,
      name: assessment.name,
      className: assessment.classes?.[0]?.name ?? "",
      assessedOn: assessment.assessed_on,
    }),
  );

  return {
    maleLearners,
    femaleLearners,
    otherLearners,
    activeLearners,
    inactiveLearners,
    enrolmentByClass,
    upcomingEvents,
    upcomingExams,
    upcomingAssessments,
    incomplete:
      learnerResult.error !== null ||
      classResult.error !== null ||
      placementResult.error !== null ||
      events === null ||
      exams === null ||
      assessmentResult.error !== null,
  };
}
