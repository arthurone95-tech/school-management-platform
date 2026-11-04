import "server-only";

import type {
  AssessmentSummary,
  ClassAcademicReport,
  GradeBandSummary,
  ResultEntry,
  ResultSheet,
} from "@/lib/academics/types";
import {
  averagePercentage,
  percentageOf,
  resolveGrade,
} from "@/lib/academics/types";
import { findOverlappingBand } from "@/lib/academics/requests";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Trusted assessment, result and report operations (docs/DECISIONS.md D-031).
 *
 * Every read and write runs on the caller's *session* client, as in D-018, D-027,
 * D-028 and D-029. The school id is resolved from the caller's own membership
 * before these are called, so Row Level Security is the enforcement boundary and
 * `can_access_class` (migration 0006) keeps a teacher inside the classes they are
 * assigned to.
 *
 * Grading is the school's own configuration, never an assumption: with no
 * `grade_bands` rows a percentage is still reported, and its grade is `null`.
 */

export type FailureReason = "not_found" | "duplicate" | "invalid" | "other";

export interface WriteFailure {
  readonly ok: false;
  readonly reason: FailureReason;
  readonly message: string;
}

export function classify(error: unknown): FailureReason {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "23505":
      return "duplicate";
    case "23514":
    case "23503":
      return "invalid";
    default:
      return "other";
  }
}

/** RLS refusals surface as `42501`, or `PGRST301` through PostgREST. */
export function isPolicyRefusal(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42501" || code === "PGRST301";
}

export function failureMessage(reason: FailureReason, subject: string): string {
  switch (reason) {
    case "duplicate":
      return `That ${subject.toLowerCase()} already exists.`;
    case "invalid":
      return `That ${subject.toLowerCase()} is not valid.`;
    case "not_found":
      return `The ${subject.toLowerCase()} could not be found.`;
    default:
      return `The ${subject.toLowerCase()} could not be saved.`;
  }
}

// ---------------------------------------------------------------------------
// Grade bands
// ---------------------------------------------------------------------------

interface GradeBandRow {
  readonly id: string;
  readonly min_percentage: number;
  readonly label: string;
  readonly remark: string | null;
  readonly is_passing: boolean;
}

function toGradeBand(row: GradeBandRow): GradeBandSummary {
  return {
    id: row.id,
    minPercentage: Number(row.min_percentage),
    label: row.label,
    remark: row.remark,
    isPassing: row.is_passing,
  };
}

/** The school's grading bands, lowest bound first. */
export async function listGradeBands(
  supabase: ServerClient,
  schoolId: string,
): Promise<GradeBandSummary[] | null> {
  const { data, error } = await supabase
    .from("grade_bands")
    .select("id, min_percentage, label, remark, is_passing")
    .eq("school_id", schoolId)
    .order("min_percentage", { ascending: false });

  if (error || !data) {
    return null;
  }
  return (data as GradeBandRow[]).map(toGradeBand);
}

/**
 * Adds a band, refusing one that would split an existing band's range.
 *
 * The overlap check runs here as well as the unique index, because the unique
 * index cannot see a *range* overlap: with bands at 50 and 70, adding 60 is not a
 * duplicate key but would silently regrade every score already recorded.
 */
export async function createGradeBand(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly minPercentage: number;
  readonly label: string;
  readonly remark: string | null;
  readonly isPassing: boolean;
}): Promise<
  { readonly ok: true; readonly band: GradeBandSummary } | WriteFailure
> {
  const existing = await listGradeBands(input.supabase, input.schoolId);
  if (existing === null) {
    return {
      ok: false,
      reason: "other",
      message: "The grade bands could not be loaded.",
    };
  }

  const overlap = findOverlappingBand(input.minPercentage, existing);
  if (overlap !== null) {
    return {
      ok: false,
      reason: "duplicate",
      message:
        overlap.minPercentage === input.minPercentage
          ? `A band starting at ${input.minPercentage}% already exists.`
          : `That overlaps the existing "${overlap.label}" band. Remove or edit that band first.`,
    };
  }

  const { data, error } = await input.supabase
    .from("grade_bands")
    .insert({
      school_id: input.schoolId,
      min_percentage: input.minPercentage,
      label: input.label,
      remark: input.remark,
      is_passing: input.isPassing,
    })
    .select("id, min_percentage, label, remark, is_passing")
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Grade band") };
  }
  return { ok: true, band: toGradeBand(data as GradeBandRow) };
}

/** Edits a band. Moving its bound is checked for overlap exactly as creation is. */
export async function updateGradeBand(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly bandId: string;
  readonly label?: string;
  readonly remark?: string | null;
  readonly isPassing?: boolean;
}): Promise<
  { readonly ok: true; readonly band: GradeBandSummary } | WriteFailure
> {
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.remark !== undefined) patch.remark = input.remark;
  if (input.isPassing !== undefined) patch.is_passing = input.isPassing;

  if (Object.keys(patch).length === 0) {
    return { ok: false, reason: "invalid", message: "Invalid request body." };
  }

  const { data, error } = await input.supabase
    .from("grade_bands")
    .update(patch)
    .eq("id", input.bandId)
    .eq("school_id", input.schoolId)
    .select("id, min_percentage, label, remark, is_passing")
    .maybeSingle();

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Grade band") };
  }
  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Grade band"),
    };
  }
  return { ok: true, band: toGradeBand(data as GradeBandRow) };
}

/**
 * Removes a band.
 *
 * Grades already computed from it are stored per-assessment, not per band, so
 * removing a band cannot rewrite history: a stored result keeps the score and its
 * percentage. Only future grading changes.
 */
export async function deleteGradeBand(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly bandId: string;
}): Promise<{ readonly ok: true } | WriteFailure> {
  const { error } = await input.supabase
    .from("grade_bands")
    .delete()
    .eq("id", input.bandId)
    .eq("school_id", input.schoolId);

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Grade band") };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

interface AssessmentRow {
  readonly id: string;
  readonly class_id: string;
  readonly subject_id: string | null;
  readonly term_id: string | null;
  readonly name: string;
  readonly framework: "ges_standard" | "custom";
  readonly max_score: number;
  readonly assessed_on: string;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly classes: { readonly name: string }[] | null;
  readonly subjects: { readonly name: string }[] | null;
}

const ASSESSMENT_SELECT =
  "id, class_id, subject_id, term_id, name, framework, max_score, assessed_on, notes, is_active, classes ( name ), subjects ( name )";

export async function listAssessments(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string | null;
  readonly includeInactive: boolean;
  readonly framework: "ges_standard" | "custom";
}): Promise<AssessmentSummary[] | null> {
  const { supabase, schoolId } = input;

  let query = supabase
    .from("assessments")
    .select(ASSESSMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("framework", input.framework);

  if (input.classId !== null) {
    query = query.eq("class_id", input.classId);
  }
  if (!input.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("assessed_on", {
    ascending: false,
  });
  if (error || !data) {
    return null;
  }

  const rows = data as AssessmentRow[];
  const counts = await countResults(supabase, schoolId, rows);

  return rows.map((row) => ({
    id: row.id,
    classId: row.class_id,
    className: row.classes?.[0]?.name ?? "",
    subjectId: row.subject_id,
    subjectName: row.subjects?.[0]?.name ?? null,
    termId: row.term_id,
    name: row.name,
    maxScore: Number(row.max_score),
    assessedOn: row.assessed_on,
    notes: row.notes,
    isActive: row.is_active,
    markedCount: counts.get(row.id) ?? 0,
    learnerCount: counts.get(`roster:${row.id}`) ?? 0,
  }));
}

/**
 * Marks already recorded and roster size per assessment, in two queries rather
 * than one per assessment.
 */
async function countResults(
  supabase: ServerClient,
  schoolId: string,
  rows: readonly AssessmentRow[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (rows.length === 0) {
    return counts;
  }

  const byClass = new Map<string, string[]>();
  for (const row of rows) {
    const list = byClass.get(row.class_id) ?? [];
    list.push(row.id);
    byClass.set(row.class_id, list);
  }

  for (const [classId, assessmentIds] of byClass) {
    const { data: resultRows } = await supabase
      .from("assessment_results")
      .select("assessment_id, score")
      .eq("school_id", schoolId)
      .in("assessment_id", assessmentIds);

    const marked = new Map<string, number>();
    for (const row of (resultRows ?? []) as {
      assessment_id: string;
      score: number | null;
    }[]) {
      if (row.score === null) {
        continue;
      }
      marked.set(row.assessment_id, (marked.get(row.assessment_id) ?? 0) + 1);
    }

    const { data: roster } = await supabase.rpc("class_roster", {
      target_school_id: schoolId,
      target_class_id: classId,
    });
    const rosterSize = (roster ?? []).length;

    for (const assessmentId of assessmentIds) {
      counts.set(assessmentId, marked.get(assessmentId) ?? 0);
      counts.set(`roster:${assessmentId}`, rosterSize);
    }
  }

  return counts;
}

export async function createAssessment(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly subjectId: string | null;
  readonly termId: string | null;
  readonly name: string;
  readonly maxScore: number;
  readonly assessedOn: string;
  readonly notes: string | null;
}): Promise<
  { readonly ok: true; readonly assessment: AssessmentSummary } | WriteFailure
> {
  const { data, error } = await input.supabase
    .from("assessments")
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      subject_id: input.subjectId,
      term_id: input.termId,
      name: input.name,
      max_score: input.maxScore,
      assessed_on: input.assessedOn,
      notes: input.notes,
      framework: "custom",
    })
    .select(ASSESSMENT_SELECT)
    .maybeSingle();

  if (error || !data) {
    if (isPolicyRefusal(error)) {
      return {
        ok: false,
        reason: "not_found",
        message: failureMessage("not_found", "Class"),
      };
    }
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Assessment") };
  }

  const row = data as AssessmentRow;
  return {
    ok: true,
    assessment: {
      id: row.id,
      classId: row.class_id,
      className: row.classes?.[0]?.name ?? "",
      subjectId: row.subject_id,
      subjectName: row.subjects?.[0]?.name ?? null,
      termId: row.term_id,
      name: row.name,
      maxScore: Number(row.max_score),
      assessedOn: row.assessed_on,
      notes: row.notes,
      isActive: row.is_active,
      markedCount: 0,
      learnerCount: 0,
    },
  };
}

export async function updateAssessment(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly name?: string;
  readonly maxScore?: number;
  readonly assessedOn?: string;
  readonly notes?: string | null;
  readonly isActive?: boolean;
}): Promise<
  { readonly ok: true; readonly assessment: AssessmentSummary } | WriteFailure
> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.maxScore !== undefined) patch.max_score = input.maxScore;
  if (input.assessedOn !== undefined) patch.assessed_on = input.assessedOn;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  if (Object.keys(patch).length === 0) {
    return { ok: false, reason: "invalid", message: "Invalid request body." };
  }

  const { data, error } = await input.supabase
    .from("assessments")
    .update(patch)
    .eq("id", input.assessmentId)
    .eq("school_id", input.schoolId)
    .select(ASSESSMENT_SELECT)
    .maybeSingle();

  if (error) {
    // Lowering a maximum below marks already recorded is refused by the score
    // trigger's ceiling check on the next write, and by this classification here.
    const reason = classify(error);
    return {
      ok: false,
      reason,
      message: failureMessage(reason, "Assessment"),
    };
  }
  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Assessment"),
    };
  }

  const row = data as AssessmentRow;
  return {
    ok: true,
    assessment: {
      id: row.id,
      classId: row.class_id,
      className: row.classes?.[0]?.name ?? "",
      subjectId: row.subject_id,
      subjectName: row.subjects?.[0]?.name ?? null,
      termId: row.term_id,
      name: row.name,
      maxScore: Number(row.max_score),
      assessedOn: row.assessed_on,
      notes: row.notes,
      isActive: row.is_active,
      markedCount: 0,
      learnerCount: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * The result sheet for one assessment: the class roster with each learner's mark,
 * percentage and the grade the school's bands give it.
 *
 * The roster comes from the gated `class_roster` function, exactly as attendance
 * does, so a teacher can mark work without holding `learner.read` and sees no
 * learner field beyond id, registration number and name.
 */
export async function getResultSheet(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly mayRecord: boolean;
}): Promise<{ readonly ok: true; readonly sheet: ResultSheet } | WriteFailure> {
  const { supabase, schoolId, assessmentId } = input;

  const { data: assessmentData, error: assessmentError } = await supabase
    .from("assessments")
    .select(ASSESSMENT_SELECT)
    .eq("id", assessmentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (assessmentError) {
    return {
      ok: false,
      reason: "other",
      message: "The result sheet could not be loaded.",
    };
  }
  if (!assessmentData) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Assessment"),
    };
  }

  const assessment = assessmentData as AssessmentRow;
  if (assessment.framework !== "custom") {
    return {
      ok: false,
      reason: "invalid",
      message:
        "This assessment uses the GES 50 + 50 framework. Open the GES score sheet instead.",
    };
  }
  const maxScore = Number(assessment.max_score);

  const [
    { data: rosterData, error: rosterError },
    { data: resultData },
    bands,
  ] = await Promise.all([
    supabase.rpc("class_roster", {
      target_school_id: schoolId,
      target_class_id: assessment.class_id,
    }),
    supabase
      .from("assessment_results")
      .select("learner_id, score, remark")
      .eq("school_id", schoolId)
      .eq("assessment_id", assessmentId),
    listGradeBands(supabase, schoolId),
  ]);

  if (rosterError || !rosterData) {
    return {
      ok: false,
      reason: "other",
      message: "The result sheet could not be loaded.",
    };
  }

  const gradeBands = bands ?? [];

  const marked = new Map<
    string,
    { score: number | null; remark: string | null }
  >();
  for (const row of (resultData ?? []) as {
    learner_id: string;
    score: number | null;
    remark: string | null;
  }[]) {
    marked.set(row.learner_id, { score: row.score, remark: row.remark });
  }

  const roster = rosterData as {
    learner_id: string;
    registration_number: string;
    full_name: string;
  }[];

  const entries: ResultEntry[] = roster.map((row) => {
    const existing = marked.get(row.learner_id);
    const score = existing?.score ?? null;
    const percentage =
      score === null ? null : percentageOf(Number(score), maxScore);
    return {
      learnerId: row.learner_id,
      registrationNumber: row.registration_number,
      fullName: row.full_name,
      score,
      percentage,
      grade: percentage === null ? null : resolveGrade(gradeBands, percentage),
      remark: existing?.remark ?? null,
    };
  });

  return {
    ok: true,
    sheet: {
      assessment: {
        id: assessment.id,
        classId: assessment.class_id,
        className: assessment.classes?.[0]?.name ?? "",
        subjectId: assessment.subject_id,
        subjectName: assessment.subjects?.[0]?.name ?? null,
        termId: assessment.term_id,
        name: assessment.name,
        maxScore,
        assessedOn: assessment.assessed_on,
        notes: assessment.notes,
        isActive: assessment.is_active,
        markedCount: entries.filter((entry) => entry.score !== null).length,
        learnerCount: entries.length,
      },
      entries,
      isEditable: input.mayRecord && assessment.is_active,
    },
  };
}

export interface ResultEntryInput {
  readonly learnerId: string;
  readonly score: number | null;
  readonly remark: string | null;
}

/**
 * Writes a whole result sheet, upserting by `(assessment_id, learner_id)`.
 *
 * Every submitted learner must be on the current class roster, so a mark cannot
 * be attached to a learner who is not in the class. Re-submitting unchanged
 * scores writes nothing new. Results are records: this path never deletes.
 */
export async function submitResultSheet(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly entries: readonly ResultEntryInput[];
  readonly mayRecord: boolean;
}): Promise<{ readonly ok: true; readonly sheet: ResultSheet } | WriteFailure> {
  const { supabase, schoolId, assessmentId, entries } = input;

  const { data: assessmentData, error: assessmentError } = await supabase
    .from("assessments")
    .select("id, class_id, is_active, framework")
    .eq("id", assessmentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (assessmentError) {
    return {
      ok: false,
      reason: "other",
      message: "The result sheet could not be saved.",
    };
  }
  if (!assessmentData) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Assessment"),
    };
  }

  const assessment = assessmentData as {
    id: string;
    class_id: string;
    is_active: boolean;
    framework: "ges_standard" | "custom";
  };

  if (assessment.framework !== "custom") {
    return {
      ok: false,
      reason: "invalid",
      message:
        "This assessment uses the GES 50 + 50 framework. Record it on the GES score sheet instead.",
    };
  }

  if (!assessment.is_active) {
    return {
      ok: false,
      reason: "invalid",
      message:
        "This assessment has been retired. Reactivate it to record marks.",
    };
  }

  const { data: rosterData, error: rosterError } = await supabase.rpc(
    "class_roster",
    { target_school_id: schoolId, target_class_id: assessment.class_id },
  );

  if (rosterError || !rosterData) {
    return {
      ok: false,
      reason: "other",
      message: "The result sheet could not be saved.",
    };
  }

  const rosterIds = new Set(
    (rosterData as { learner_id: string }[]).map((row) => row.learner_id),
  );

  const unknown = entries.filter((entry) => !rosterIds.has(entry.learnerId));
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: "invalid",
      message:
        "The sheet must mark only learners currently in the class. Reload and try again.",
    };
  }

  const { data: existingData } = await supabase
    .from("assessment_results")
    .select("learner_id")
    .eq("school_id", schoolId)
    .eq("assessment_id", assessmentId);

  const existingIds = new Set(
    (existingData ?? []).map(
      (row) => (row as { learner_id: string }).learner_id,
    ),
  );

  for (const entry of entries) {
    const result = existingIds.has(entry.learnerId)
      ? await supabase
          .from("assessment_results")
          .update({ score: entry.score, remark: entry.remark })
          .eq("school_id", schoolId)
          .eq("assessment_id", assessmentId)
          .eq("learner_id", entry.learnerId)
      : await supabase.from("assessment_results").insert({
          school_id: schoolId,
          assessment_id: assessmentId,
          learner_id: entry.learnerId,
          score: entry.score,
          remark: entry.remark,
        });

    if (result.error) {
      if (isPolicyRefusal(result.error)) {
        return {
          ok: false,
          reason: "not_found",
          message: failureMessage("not_found", "Assessment"),
        };
      }
      const reason = classify(result.error);
      return {
        ok: false,
        reason,
        message: failureMessage(reason, "Assessment"),
      };
    }
  }

  return getResultSheet({
    supabase,
    schoolId,
    assessmentId,
    mayRecord: input.mayRecord,
  });
}

// ---------------------------------------------------------------------------
// Class academic report
// ---------------------------------------------------------------------------

/**
 * A class's assessments and per-learner summary over a window.
 *
 * The averages are deliberately **unweighted** arithmetic means of the marked
 * percentages: weighting is a grading rule `docs/PRD.md` 11 records as
 * unvalidated, so this slice reports what was marked and labels it plainly
 * rather than inventing weights. `gradingIsConfigured` tells the interface to
 * say so plainly when the school has no bands, instead of showing a blank column.
 */
export async function buildClassAcademicReport(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly from: string | null;
  readonly to: string | null;
}): Promise<ClassAcademicReport | null> {
  const { supabase, schoolId, classId } = input;

  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (classError) {
    return null;
  }
  if (!classData) {
    return null;
  }

  let query = supabase
    .from("assessments")
    .select(
      "id, name, max_score, assessed_on, assessment_results ( learner_id, score )",
    )
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("framework", "custom")
    .eq("is_active", true);

  if (input.from !== null) {
    query = query.gte("assessed_on", input.from);
  }
  if (input.to !== null) {
    query = query.lte("assessed_on", input.to);
  }

  const { data: assessmentData, error: assessmentError } = await query.order(
    "assessed_on",
    { ascending: false },
  );

  if (assessmentError) {
    return null;
  }

  const assessments = (assessmentData ?? []) as {
    id: string;
    name: string;
    max_score: number;
    assessed_on: string;
    assessment_results: { learner_id: string; score: number | null }[] | null;
  }[];

  const [rosterResult, bands] = await Promise.all([
    supabase.rpc("class_roster", {
      target_school_id: schoolId,
      target_class_id: classId,
    }),
    listGradeBands(supabase, schoolId),
  ]);

  const roster = (rosterResult.data ?? []) as {
    learner_id: string;
    registration_number: string;
    full_name: string;
  }[];

  const gradeBands = bands ?? [];
  const rosterSize = roster.length;

  // learnerId -> assessmentId -> percentage, so a learner who joins mid-term is
  // only averaged over what they were actually assessed on.
  const perLearner = new Map<string, Map<string, number | null>>();

  const rows = assessments.map((assessment) => {
    const maxScore = Number(assessment.max_score);
    const percentages: (number | null)[] = [];

    for (const result of assessment.assessment_results ?? []) {
      const percentage =
        result.score === null
          ? null
          : percentageOf(Number(result.score), maxScore);
      percentages.push(percentage);

      const learnerMap =
        perLearner.get(result.learner_id) ?? new Map<string, number | null>();
      learnerMap.set(assessment.id, percentage);
      perLearner.set(result.learner_id, learnerMap);
    }

    const marked = percentages.filter(
      (value): value is number => value !== null,
    );

    return {
      assessmentId: assessment.id,
      name: assessment.name,
      maxScore,
      assessedOn: assessment.assessed_on,
      averagePercentage: averagePercentage(percentages),
      highestPercentage: marked.length === 0 ? null : Math.max(...marked),
      lowestPercentage: marked.length === 0 ? null : Math.min(...marked),
      passedCount: marked.filter(
        (value) => resolveGrade(gradeBands, value)?.isPassing === true,
      ).length,
      markedCount: marked.length,
      learnerCount: rosterSize,
    };
  });

  return {
    classId,
    className: (classData as { name: string }).name,
    from: input.from,
    to: input.to,
    gradingIsConfigured: gradeBands.length > 0,
    assessments: rows,
    learners: roster.map((row) => {
      const learnerMap = perLearner.get(row.learner_id);
      const percentages = learnerMap ? Array.from(learnerMap.values()) : [];
      const best = averagePercentage(percentages);
      return {
        learnerId: row.learner_id,
        registrationNumber: row.registration_number,
        fullName: row.full_name,
        averagePercentage: best,
        bestGrade: best === null ? null : resolveGrade(gradeBands, best),
        assessmentsTaken: percentages.filter((value) => value !== null).length,
      };
    }),
  };
}
