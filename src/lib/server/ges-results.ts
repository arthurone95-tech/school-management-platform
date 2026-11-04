import "server-only";

import type { GesScoreSubmitInput } from "@/lib/academics/ges-requests";
import type {
  GesClassOption,
  GesLearnerResult,
  GesSheet,
  GesSubjectScore,
  GesTermOption,
} from "@/lib/academics/ges-types";
import {
  calculateGesResult,
  rankScores,
  validateGesScores,
} from "@/lib/school/ges-calculator";
import {
  getAssessableSubjectsForClass,
  isEarlyYearsClass,
} from "@/lib/school/subjects";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import type { WriteFailure } from "./academics";
import { classify, failureMessage, isPolicyRefusal } from "./academics";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

interface ClassRow {
  readonly class_id: string;
  readonly class_name: string;
  readonly is_active: boolean;
}

interface TermRow {
  readonly term_id: string;
  readonly term_name: string;
  readonly term_starts_on: string;
  readonly term_ends_on: string;
  readonly academic_year_id: string;
  readonly academic_year_name: string;
  readonly year_is_current: boolean;
}

interface AssessmentRow {
  readonly id: string;
  readonly name: string;
  readonly assessment_results:
    | {
        readonly learner_id: string;
        readonly class_score: number | null;
        readonly exam_score: number | null;
      }[]
    | null;
}

interface RosterRow {
  readonly learner_id: string;
  readonly registration_number: string;
  readonly full_name: string;
}

export interface GesOptions {
  readonly classes: readonly GesClassOption[];
  readonly terms: readonly GesTermOption[];
}

class UnknownGesSubjectError extends Error {}

function roundAverage(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Classes the caller may see, through the gated `accessible_classes` helper. */
export async function listGesClasses(
  supabase: ServerClient,
  schoolId: string,
): Promise<GesClassOption[] | null> {
  const { data, error } = await supabase.rpc("accessible_classes", {
    target_school_id: schoolId,
  });
  if (error || !data) {
    return null;
  }
  return (data as ClassRow[])
    .map((row) => ({
      id: row.class_id,
      name: row.class_name,
      isActive: row.is_active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Term options for the GES screen. A teacher holds `assessment.read` but not
 * `academic.read`, so this goes through the narrowly gated
 * `assessment_terms` function from migration 0012.
 */
export async function listGesTerms(
  supabase: ServerClient,
  schoolId: string,
): Promise<GesTermOption[] | null> {
  const { data, error } = await supabase.rpc("assessment_terms", {
    target_school_id: schoolId,
  });
  if (error || !data) {
    return null;
  }
  return (data as TermRow[]).map((row) => ({
    id: row.term_id,
    name: row.term_name,
    startsOn: row.term_starts_on,
    endsOn: row.term_ends_on,
    academicYearId: row.academic_year_id,
    academicYearName: row.academic_year_name,
    isCurrent: row.year_is_current,
  }));
}

export async function getGesOptions(
  supabase: ServerClient,
  schoolId: string,
): Promise<GesOptions | null> {
  const [classes, terms] = await Promise.all([
    listGesClasses(supabase, schoolId),
    listGesTerms(supabase, schoolId),
  ]);
  if (classes === null || terms === null) {
    return null;
  }
  return { classes, terms };
}

function defaultTerm(
  terms: readonly GesTermOption[],
  today: string,
): GesTermOption | null {
  const current = terms.find(
    (term) =>
      term.isCurrent && term.startsOn <= today && term.endsOn >= today,
  );
  return current ?? terms.find((term) => term.isCurrent) ?? terms[0] ?? null;
}

function nextTermStart(
  terms: readonly GesTermOption[],
  selected: GesTermOption,
): string | null {
  const ordered = [...terms].sort((a, b) =>
    a.startsOn.localeCompare(b.startsOn),
  );
  const index = ordered.findIndex((term) => term.id === selected.id);
  const next = index >= 0 ? ordered[index + 1] : undefined;
  return next?.startsOn ?? null;
}

function subjectKey(name: string): string {
  return name.trim().toLowerCase();
}

function getSubject(
  subjects: readonly GesSubjectScore[],
  name: string,
): GesSubjectScore | undefined {
  return subjects.find((subject) => subject.subjectName === name);
}

/**
 * Builds one class's GES terminal sheet for a term.
 *
 * The official subject list comes from `getSubjectsForClass`, never from the
 * school's custom subject table. Positions are re-ranked from the saved totals:
 * a subject position is a competition rank within the class for that subject,
 * and the class position is a competition rank by the learner's aggregate total.
 * A learner with no mark in a subject (or no marks at all) has no position rather
 * than being placed last.
 */
export async function getGesSheet(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly termId: string | null;
  readonly mayRecord: boolean;
  readonly today: string;
  readonly options?: GesOptions;
}): Promise<{ readonly ok: true; readonly sheet: GesSheet } | WriteFailure> {
  const { supabase, schoolId, classId } = input;
  const options = input.options ?? (await getGesOptions(supabase, schoolId));
  if (!options) {
    return {
      ok: false,
      reason: "other",
      message: "The GES score sheet could not be loaded.",
    };
  }

  const klass = options.classes.find((entry) => entry.id === classId);
  if (!klass) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Class"),
    };
  }

  const term = input.termId
    ? options.terms.find((entry) => entry.id === input.termId)
    : defaultTerm(options.terms, input.today);

  if (!term) {
    return {
      ok: false,
      reason: input.termId ? "not_found" : "invalid",
      message: input.termId
        ? failureMessage("not_found", "Term")
        : "No academic term is set up yet. An administrator must configure the academic year and terms first.",
    };
  }

  const { data: rosterData, error: rosterError } = await supabase.rpc(
    "class_roster",
    { target_school_id: schoolId, target_class_id: classId },
  );
  if (rosterError || !rosterData) {
    return {
      ok: false,
      reason: "other",
      message: "The GES score sheet could not be loaded.",
    };
  }
  const roster = rosterData as RosterRow[];

  const subjectNames = getAssessableSubjectsForClass(klass.name);
  const earlyYears = isEarlyYearsClass(klass.name);

  if (earlyYears) {
    return {
      ok: true,
      sheet: {
        classId,
        className: klass.name,
        termId: term.id,
        termName: term.name,
        academicYearName: term.academicYearName,
        nextTermBegins: nextTermStart(options.terms, term),
        earlyYears: true,
        subjects: subjectNames,
        learners: roster.map((learner) => ({
          learnerId: learner.learner_id,
          registrationNumber: learner.registration_number,
          fullName: learner.full_name,
          subjects: [],
          totalScore: null,
          averageScore: null,
          markedSubjects: 0,
          isComplete: false,
          position: null,
        })),
        isEditable: false,
      },
    };
  }

  const { data: assessmentData, error: assessmentError } = await supabase
    .from("assessments")
    .select(
      "id, name, assessment_results ( learner_id, class_score, exam_score )",
    )
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("framework", "ges_standard")
    .eq("term_id", term.id)
    .eq("is_active", true);

  if (assessmentError) {
    return {
      ok: false,
      reason: "other",
      message: "The GES score sheet could not be loaded.",
    };
  }

  const assessmentBySubject = new Map<
    string,
    {
      readonly id: string;
      readonly results: Map<
        string,
        { readonly classScore: number | null; readonly examScore: number | null }
      >;
    }
  >();

  for (const assessment of (assessmentData ?? []) as AssessmentRow[]) {
    const results = new Map<
      string,
      { readonly classScore: number | null; readonly examScore: number | null }
    >();
    for (const result of assessment.assessment_results ?? []) {
      results.set(result.learner_id, {
        classScore:
          result.class_score === null ? null : Number(result.class_score),
        examScore: result.exam_score === null ? null : Number(result.exam_score),
      });
    }
    assessmentBySubject.set(subjectKey(assessment.name), {
      id: assessment.id,
      results,
    });
  }

  const learners: GesLearnerResult[] = roster.map((learner) => {
    const subjects: GesSubjectScore[] = subjectNames.map((name) => {
      const assessment = assessmentBySubject.get(subjectKey(name));
      const result = assessment?.results.get(learner.learner_id);
      const calculated = calculateGesResult(
        result?.classScore ?? null,
        result?.examScore ?? null,
      );
      return {
        subjectName: name,
        assessmentId: assessment?.id ?? null,
        classScore: calculated.classScore,
        examScore: calculated.examScore,
        totalScore: calculated.totalScore,
        grade: calculated.grade,
        proficiency: calculated.proficiency,
        position: null,
      };
    });

    const marked = subjects.filter(
      (subject) => subject.totalScore !== null,
    );
    const totalScore =
      marked.length === 0
        ? null
        : roundAverage(
            marked.reduce(
              (sum, subject) => sum + (subject.totalScore ?? 0),
              0,
            ),
          );

    return {
      learnerId: learner.learner_id,
      registrationNumber: learner.registration_number,
      fullName: learner.full_name,
      subjects,
      totalScore,
      averageScore:
        totalScore === null || marked.length === 0
          ? null
          : roundAverage(totalScore / marked.length),
      markedSubjects: marked.length,
      isComplete:
        subjectNames.length > 0 && marked.length === subjectNames.length,
      position: null,
    };
  });

  // Rank each subject across the class, then rank the aggregate totals. The
  // helper omits unmarked entries, which is why a null position is possible.
  const subjectRanks = subjectNames.map((name) =>
    rankScores(
      learners.map((learner) => ({
        id: learner.learnerId,
        score: getSubject(learner.subjects, name)?.totalScore ?? null,
      })),
    ),
  );
  const overallRanks = rankScores(
    learners.map((learner) => ({
      id: learner.learnerId,
      score: learner.totalScore,
    })),
  );

  const rankedLearners = learners.map((learner) => ({
    ...learner,
    subjects: learner.subjects.map((subject, index) => ({
      ...subject,
      position: subjectRanks[index]?.get(learner.learnerId) ?? null,
    })),
    position: overallRanks.get(learner.learnerId) ?? null,
  }));

  return {
    ok: true,
    sheet: {
      classId,
      className: klass.name,
      termId: term.id,
      termName: term.name,
      academicYearName: term.academicYearName,
      nextTermBegins: nextTermStart(options.terms, term),
      earlyYears: false,
      subjects: subjectNames,
      learners: rankedLearners,
      isEditable: input.mayRecord,
    },
  };
}

/**
 * Saves one learner's GES subject scores.
 *
 * Missing subject assessments are created on demand from the official list, so
 * a teacher does not have to configure twelve assessments before entering the
 * first mark. Every created assessment is tagged `ges_standard` and tied to the
 * selected term, keeping custom and GES records separate.
 */
export async function submitGesScores(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly userId: string;
  readonly mayRecord: boolean;
  readonly today: string;
  readonly submit: GesScoreSubmitInput;
}): Promise<{ readonly ok: true; readonly sheet: GesSheet } | WriteFailure> {
  const { supabase, schoolId, userId, submit, today } = input;

  const options = await getGesOptions(supabase, schoolId);
  if (!options) {
    return {
      ok: false,
      reason: "other",
      message: "The GES scores could not be saved.",
    };
  }

  const klass = options.classes.find((entry) => entry.id === submit.classId);
  if (!klass) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Class"),
    };
  }
  const term = options.terms.find((entry) => entry.id === submit.termId);
  if (!term) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Term"),
    };
  }
  if (isEarlyYearsClass(klass.name)) {
    return {
      ok: false,
      reason: "invalid",
      message:
        "Early-years classes use developmental rubrics, not the Basic/JHS 50 + 50 score sheet.",
    };
  }

  const official = getAssessableSubjectsForClass(klass.name);
  const officialByKey = new Map(
    official.map((name) => [subjectKey(name), name] as const),
  );

  for (const score of submit.scores) {
    const validated = validateGesScores(score.classScore, score.examScore);
    if (!validated.ok) {
      return { ok: false, reason: "invalid", message: validated.message };
    }
  }

  const canonicalScores = submit.scores.map((score) => {
    const canonical = officialByKey.get(subjectKey(score.subjectName));
    if (!canonical) {
      throw new UnknownGesSubjectError();
    }
    return { ...score, subjectName: canonical };
  });

  const { data: rosterData, error: rosterError } = await supabase.rpc(
    "class_roster",
    { target_school_id: schoolId, target_class_id: submit.classId },
  );
  if (rosterError || !rosterData) {
    return {
      ok: false,
      reason: "other",
      message: "The GES scores could not be saved.",
    };
  }
  const rosterIds = new Set(
    (rosterData as RosterRow[]).map((row) => row.learner_id),
  );
  if (!rosterIds.has(submit.learnerId)) {
    return {
      ok: false,
      reason: "invalid",
      message:
        "That learner is not currently in this class. Reload the sheet and try again.",
    };
  }

  try {
    const subjectNames = canonicalScores.map((score) => score.subjectName);

    const { data: existingData, error: existingError } = await supabase
      .from("assessments")
      .select("id, name")
      .eq("school_id", schoolId)
      .eq("class_id", submit.classId)
      .eq("framework", "ges_standard")
      .eq("term_id", term.id)
      .eq("is_active", true)
      .in("name", subjectNames);

    if (existingError) {
      return {
        ok: false,
        reason: classify(existingError),
        message: "The GES subject assessments could not be loaded.",
      };
    }

    const assessmentByName = new Map<string, { id: string; name: string }>();
    for (const row of (existingData ?? []) as { id: string; name: string }[]) {
      assessmentByName.set(subjectKey(row.name), row);
    }

    // Create an assessment only for a subject that has a mark to store. A
    // learner whose row is entirely blank needs no new assessments; an existing
    // one can still be cleared below.
    const missing = subjectNames.filter((name) => {
      if (assessmentByName.has(subjectKey(name))) {
        return false;
      }
      const score = canonicalScores.find(
        (entry) => entry.subjectName === name,
      );
      return score?.classScore !== null && score?.classScore !== undefined
        ? true
        : score?.examScore !== null && score?.examScore !== undefined;
    });
    if (missing.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("assessments")
        .insert(
          missing.map((name) => ({
            school_id: schoolId,
            class_id: submit.classId,
            subject_id: null,
            academic_year_id: term.academicYearId,
            term_id: term.id,
            name,
            max_score: 100,
            assessed_on: today,
            notes: "GES 50 + 50 terminal subject",
            framework: "ges_standard",
            created_by: userId,
          })),
        )
        .select("id, name");

      if (insertError) {
        if (isPolicyRefusal(insertError)) {
          return {
            ok: false,
            reason: "not_found",
            message:
              "You do not have permission to create the GES subject assessments.",
          };
        }
        const reason = classify(insertError);
        return {
          ok: false,
          reason,
          message: failureMessage(reason, "GES subject assessment"),
        };
      }

      for (const row of (inserted ?? []) as { id: string; name: string }[]) {
        assessmentByName.set(subjectKey(row.name), row);
      }
    }

    const assessmentIds = canonicalScores
      .map((score) => assessmentByName.get(subjectKey(score.subjectName))?.id)
      .filter((id): id is string => typeof id === "string");

    const existingResults = new Set<string>();
    if (assessmentIds.length > 0) {
      const { data: resultData, error: resultError } = await supabase
        .from("assessment_results")
        .select("assessment_id")
        .eq("school_id", schoolId)
        .eq("learner_id", submit.learnerId)
        .in("assessment_id", assessmentIds);

      if (resultError) {
        return {
          ok: false,
          reason: classify(resultError),
          message: "The GES scores could not be saved.",
        };
      }
      for (const row of (resultData ?? []) as { assessment_id: string }[]) {
        existingResults.add(row.assessment_id);
      }
    }

    for (const score of canonicalScores) {
      const assessment = assessmentByName.get(subjectKey(score.subjectName));
      if (!assessment) {
        // A blank subject that has never been set up has nothing to write.
        if (score.classScore === null && score.examScore === null) {
          continue;
        }
        return {
          ok: false,
          reason: "other",
          message: "The GES scores could not be saved.",
        };
      }

      // Clearing a row that has never been saved needs no write.
      if (
        score.classScore === null &&
        score.examScore === null &&
        !existingResults.has(assessment.id)
      ) {
        continue;
      }

      const patch = {
        class_score: score.classScore,
        exam_score: score.examScore,
        graded_by: userId,
        graded_at: new Date().toISOString(),
      };

      const result = existingResults.has(assessment.id)
        ? await supabase
            .from("assessment_results")
            .update(patch)
            .eq("school_id", schoolId)
            .eq("assessment_id", assessment.id)
            .eq("learner_id", submit.learnerId)
        : await supabase.from("assessment_results").insert({
            school_id: schoolId,
            assessment_id: assessment.id,
            learner_id: submit.learnerId,
            ...patch,
          });

      if (result.error) {
        if (isPolicyRefusal(result.error)) {
          return {
            ok: false,
            reason: "not_found",
            message: failureMessage("not_found", "GES assessment"),
          };
        }
        const reason = classify(result.error);
        return {
          ok: false,
          reason,
          message: failureMessage(reason, "GES score"),
        };
      }
    }
  } catch (error) {
    if (!(error instanceof UnknownGesSubjectError)) {
      throw error;
    }
    return {
      ok: false,
      reason: "invalid",
      message:
        "One or more subjects are not part of the official GES list for this class.",
    };
  }

  return getGesSheet({
    supabase,
    schoolId,
    classId: submit.classId,
    termId: term.id,
    mayRecord: input.mayRecord,
    today,
    options,
  });
}
