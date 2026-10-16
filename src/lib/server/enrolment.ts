import "server-only";

import {
  deriveUsernameBase,
  isValidUsername,
  usernameWithSuffix,
} from "@/lib/domain/username";
import {
  LEARNER_PAGE_SIZE,
  type EnrolmentInput,
} from "@/lib/enrolment/requests";
import type {
  ClassSummary,
  LearnerPage,
  LearnerSummary,
} from "@/lib/enrolment/types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export type { ClassSummary, LearnerPage, LearnerSummary };

/**
 * Trusted enrolment operations (D-018): listing a school's classes, listing its
 * learners with their current class placement, and enrolling a learner.
 *
 * These run on the caller's own session client, so Row Level Security on
 * `classes`, `learners` and `learner_class_placements` is the real boundary —
 * every statement is additionally scoped to the resolved `schoolId`, and the
 * composite foreign keys keep learner, class and placement inside one school.
 * The server-only secret key is deliberately NOT used here: nothing in this
 * workflow needs to bypass RLS (docs/AGENTS.md 4, docs/DECISIONS.md D-018).
 */

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type EnrolResult =
  | {
      readonly ok: true;
      readonly learner: LearnerSummary;
      /** True when an unplaced learner already existed and was placed now. */
      readonly completedExisting: boolean;
    }
  | {
      readonly ok: false;
      readonly reason:
        "class_not_found" | "duplicate" | "placement_failed" | "other";
      readonly message: string;
    };

/** Column list shared by the single-learner and page queries. */
const LEARNER_COLUMNS =
  "id, username, registration_number, first_name, last_name, gender, date_of_birth, status";

interface RawLearner {
  id: string;
  username: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  status: string;
}

function toSummary(
  row: RawLearner,
  placement: { class_id: string; class_name: string | null } | undefined,
): LearnerSummary {
  return {
    id: row.id,
    username: row.username,
    registrationNumber: row.registration_number,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    status: row.status,
    classId: placement?.class_id ?? null,
    className: placement?.class_name ?? null,
  };
}

function errorCode(error: unknown): string {
  const maybe = error as { code?: string; message?: string } | null;
  return maybe?.code ?? "";
}

function errorText(error: unknown): string {
  const maybe = error as { message?: string; details?: string } | null;
  return `${maybe?.message ?? ""} ${maybe?.details ?? ""}`;
}

/** The active classes of one school, for the placement selector. */
export async function listActiveClasses(
  supabase: ServerClient,
  schoolId: string,
): Promise<ClassSummary[] | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return null;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

/** Maps each learner id to its current (open) placement. */
async function currentPlacements(
  supabase: ServerClient,
  learnerIds: string[],
): Promise<Map<string, { class_id: string; class_name: string | null }>> {
  const map = new Map<
    string,
    { class_id: string; class_name: string | null }
  >();
  if (learnerIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from("learner_class_placements")
    .select("learner_id, class_id, classes(name)")
    .in("learner_id", learnerIds)
    .is("ended_at", null);

  if (error || !data) {
    return map;
  }

  for (const row of data) {
    const embedded = row.classes as
      { name: string } | { name: string }[] | null;
    const className = Array.isArray(embedded)
      ? (embedded[0]?.name ?? null)
      : (embedded?.name ?? null);
    map.set(row.learner_id as string, {
      class_id: row.class_id as string,
      class_name: className,
    });
  }

  return map;
}

/**
 * One page of the school's learners, newest first, with the current placement.
 * The result set is bounded by `LEARNER_PAGE_SIZE` and a total count so the UI
 * can page through a large school (docs/AGENTS.md 6).
 */
export async function listLearners(
  supabase: ServerClient,
  schoolId: string,
  page: number,
): Promise<LearnerPage | null> {
  const size = LEARNER_PAGE_SIZE;
  const from = (page - 1) * size;
  const to = from + size - 1;

  const { data, error, count } = await supabase
    .from("learners")
    .select(LEARNER_COLUMNS, { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    return null;
  }

  const rows = (data ?? []) as RawLearner[];
  const placements = await currentPlacements(
    supabase,
    rows.map((row) => row.id),
  );

  return {
    learners: rows.map((row) => toSummary(row, placements.get(row.id))),
    page,
    pageSize: size,
    total: count ?? rows.length,
  };
}

/**
 * Chooses a username that is not already used in the school. Collision
 * resolution is `usernameWithSuffix`; the caller retries on a unique violation
 * so a concurrent insert cannot cause a duplicate.
 */
function pickUsername(base: string, taken: Set<string>): string {
  for (let index = 0; index < 1000; index += 1) {
    const candidate = usernameWithSuffix(base, index);
    if (isValidUsername(candidate) && !taken.has(candidate)) {
      return candidate;
    }
  }
  // Pathological fallback: a random, still-valid suffix.
  const random = Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  const fallback = `${base.slice(0, 20)}${random || "x"}`.slice(0, 32);
  return isValidUsername(fallback) ? fallback : "student";
}

/** Existing usernames in the school that share the derived base. */
async function loadTakenUsernames(
  supabase: ServerClient,
  schoolId: string,
  base: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("learners")
    .select("username")
    .eq("school_id", schoolId)
    .like("username", `${base}%`);

  return new Set((data ?? []).map((row) => row.username as string));
}

export interface EnrolParams {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly userId: string;
  readonly input: EnrolmentInput;
}

/**
 * Enrols a learner and creates the initial class placement.
 *
 * There is no single-call transaction available through PostgREST, so the two
 * inserts are ordered so that a failure between them can be recovered: if the
 * placement insert fails, the learner exists without a placement, and a repeat
 * of the same request (same registration number) completes the placement
 * instead of failing as a duplicate. `completedExisting` reports that case.
 */
export async function enrolLearner({
  supabase,
  schoolId,
  userId,
  input,
}: EnrolParams): Promise<EnrolResult> {
  // The class must belong to this school and be active. RLS already restricts
  // this select to the caller's school; the explicit `school_id` keeps the
  // intent obvious and the failure clean.
  const { data: klass, error: classError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", input.classId)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle<{ id: string; name: string }>();

  if (classError || !klass) {
    return {
      ok: false,
      reason: "class_not_found",
      message: "That class is not available in your school.",
    };
  }

  const base = deriveUsernameBase(input.firstName, input.lastName);
  const taken = await loadTakenUsernames(supabase, schoolId, base);

  let learnerRow: RawLearner | null = null;
  let completedExisting = false;

  for (let attempt = 0; attempt < 6 && !learnerRow; attempt += 1) {
    const username = pickUsername(base, taken);

    const { data, error } = await supabase
      .from("learners")
      .insert({
        school_id: schoolId,
        registration_number: input.registrationNumber,
        first_name: input.firstName,
        last_name: input.lastName,
        gender: input.gender,
        date_of_birth: input.dateOfBirth,
        residential_address: input.residentialAddress,
        guardian_phone: input.guardianPhone,
        guardian_email: input.guardianEmail,
        username,
      })
      .select(LEARNER_COLUMNS)
      .single<RawLearner>();

    if (!error && data) {
      learnerRow = data;
      break;
    }

    const text = errorText(error);
    const uniqueViolation = errorCode(error) === "23505";

    if (uniqueViolation && text.includes("learners_school_username_key")) {
      // Lost a race on the username; try the next candidate.
      taken.add(username);
      continue;
    }

    if (uniqueViolation && text.includes("learners_school_registration_key")) {
      // Recover an unplaced learner from a previous partial attempt.
      const { data: existing } = await supabase
        .from("learners")
        .select(LEARNER_COLUMNS)
        .eq("school_id", schoolId)
        .eq("registration_number", input.registrationNumber)
        .maybeSingle<RawLearner>();

      if (!existing) {
        return {
          ok: false,
          reason: "duplicate",
          message: "That registration number is already used in your school.",
        };
      }

      const { data: placement } = await supabase
        .from("learner_class_placements")
        .select("id")
        .eq("learner_id", existing.id)
        .is("ended_at", null)
        .maybeSingle<{ id: string }>();

      if (placement) {
        return {
          ok: false,
          reason: "duplicate",
          message: "That registration number is already enrolled in a class.",
        };
      }

      learnerRow = existing;
      completedExisting = true;
      break;
    }

    return {
      ok: false,
      reason: "other",
      message: "The student could not be registered. Please try again.",
    };
  }

  if (!learnerRow) {
    return {
      ok: false,
      reason: "other",
      message: "The student could not be registered. Please try again.",
    };
  }

  const { error: placementError } = await supabase
    .from("learner_class_placements")
    .insert({
      school_id: schoolId,
      learner_id: learnerRow.id,
      class_id: klass.id,
      created_by: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (placementError) {
    return {
      ok: false,
      reason: "placement_failed",
      message:
        "The student was registered but could not be placed in the class. Submit the same details again to complete the placement.",
    };
  }

  return {
    ok: true,
    completedExisting,
    learner: toSummary(learnerRow, {
      class_id: klass.id,
      class_name: klass.name,
    }),
  };
}
