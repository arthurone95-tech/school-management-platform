/**
 * Request parsing for the GES score-entry endpoint.
 *
 * Pure and isomorphic, like `requests.ts`. It validates shape and the 50-mark
 * ceiling; authentication, class membership, the school's active framework and
 * the set of official subjects are checked in trusted server code.
 */

import { validateGesScores } from "@/lib/school/ges-calculator";

import type { QueryReader } from "./requests";

export type GesParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Most assessable items in any GES class list, with a little headroom. */
export const GES_MAX_SUBJECTS = 60;
/** Longest official subject name accepted (matches assessments.name). */
export const GES_SUBJECT_NAME_MAX_LENGTH = 80;

export interface GesSheetQuery {
  readonly classId: string | null;
  readonly termId: string | null;
}

export interface GesSubjectScoreInput {
  readonly subjectName: string;
  readonly classScore: number | null;
  readonly examScore: number | null;
  readonly rubric: "VG" | "G" | "NH" | null;
}

export interface GesScoreSubmitInput {
  readonly classId: string;
  readonly termId: string;
  readonly learnerId: string;
  readonly scores: readonly GesSubjectScoreInput[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function requiredUuid(
  body: Record<string, unknown>,
  key: string,
  message: string,
): GesParseResult<string> {
  const raw = body[key];
  if (typeof raw !== "string" || !isUuid(raw.trim())) {
    return { ok: false, message };
  }
  return { ok: true, value: raw.trim() };
}

function optionalQueryUuid(
  query: QueryReader,
  key: string,
): GesParseResult<string | null> {
  const raw = query.get(key);
  if (raw === null || raw.trim().length === 0) {
    return { ok: true, value: null };
  }
  if (!isUuid(raw.trim())) {
    return { ok: false, message: "Invalid request." };
  }
  return { ok: true, value: raw.trim() };
}

/** Parses the optional class and term filters on the GES sheet GET. */
export function parseGesSheetQuery(query: QueryReader): GesParseResult<GesSheetQuery> {
  const classId = optionalQueryUuid(query, "classId");
  if (!classId.ok) {
    return classId;
  }
  const termId = optionalQueryUuid(query, "termId");
  if (!termId.ok) {
    return termId;
  }
  return { ok: true, value: { classId: classId.value, termId: termId.value } };
}

/**
 * Parses one learner's whole GES subject submission.
 *
 * Both components may be null so a teacher can save class scores before the
 * examination, or clear a row without deleting the academic record. The total is
 * not accepted from the client: the database generates it from the components.
 */
export function parseGesScoreSubmitInput(
  body: unknown,
): GesParseResult<GesScoreSubmitInput> {
  if (!isRecord(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  const classId = requiredUuid(body, "classId", "Choose a class.");
  if (!classId.ok) {
    return classId;
  }
  const termId = requiredUuid(body, "termId", "Choose a term.");
  if (!termId.ok) {
    return termId;
  }
  const learnerId = requiredUuid(body, "learnerId", "Choose a learner.");
  if (!learnerId.ok) {
    return learnerId;
  }

  const rawScores = body["scores"];
  if (!Array.isArray(rawScores)) {
    return { ok: false, message: "Submit the learner's subject scores." };
  }
  if (rawScores.length === 0) {
    return { ok: false, message: "Submit at least one subject score." };
  }
  if (rawScores.length > GES_MAX_SUBJECTS) {
    return {
      ok: false,
      message: `A GES score sheet can hold at most ${GES_MAX_SUBJECTS} subjects.`,
    };
  }

  const seen = new Set<string>();
  const scores: GesSubjectScoreInput[] = [];

  for (const raw of rawScores) {
    if (!isRecord(raw)) {
      return { ok: false, message: "Invalid subject score." };
    }

    const rawName = raw["subjectName"];
    const subjectName = typeof rawName === "string" ? rawName.trim() : "";
    if (
      subjectName.length === 0 ||
      subjectName.length > GES_SUBJECT_NAME_MAX_LENGTH
    ) {
      return { ok: false, message: "Invalid subject name." };
    }

    const key = subjectName.toLowerCase();
    if (seen.has(key)) {
      return {
        ok: false,
        message: "Each subject can appear only once in a learner's scores.",
      };
    }
    seen.add(key);

    const validated = validateGesScores(
      has(raw, "classScore") ? raw["classScore"] : null,
      has(raw, "examScore") ? raw["examScore"] : null,
    );
    if (!validated.ok) {
      return { ok: false, message: validated.message };
    }

    let rubric: "VG" | "G" | "NH" | null = null;
    if (has(raw, "rubric")) {
      const rawRubric = raw["rubric"];
      if (
        rawRubric !== null &&
        rawRubric !== "VG" &&
        rawRubric !== "G" &&
        rawRubric !== "NH"
      ) {
        return { ok: false, message: "Invalid qualitative rating." };
      }
      rubric = rawRubric as "VG" | "G" | "NH" | null;
    }

    scores.push({
      subjectName,
      classScore: validated.classScore,
      examScore: validated.examScore,
      rubric,
    });
  }

  return {
    ok: true,
    value: {
      classId: classId.value,
      termId: termId.value,
      learnerId: learnerId.value,
      scores,
    },
  };
}
