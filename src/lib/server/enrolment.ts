import "server-only";

import {
  deriveUsernameBase,
  isValidUsername,
  usernameWithSuffix,
} from "@/lib/domain/username";
import {
  LEARNER_PAGE_SIZE,
  type EnrolmentInput,
  type LearnerCorrectionInput,
  type LearnerStatus,
} from "@/lib/enrolment/requests";
import type {
  ClassSummary,
  LearnerDetail,
  LearnerPage,
  LearnerSummary,
} from "@/lib/enrolment/types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export type { ClassSummary, LearnerDetail, LearnerPage, LearnerSummary };

/**
 * Trusted enrolment operations (D-018): listing a school's classes, listing its
 * learners with their current class placement, enrolling a learner, and the
 * Phase 3 administration operations over the same records — creating and
 * updating a class, correcting a learner, activating/deactivating a learner,
 * and changing a learner's class placement (D-028).
 *
 * These run on the caller's own session client, so Row Level Security on
 * `classes`, `learners` and `learner_class_placements` is the real boundary —
 * every statement is additionally scoped to the resolved `schoolId`, and the
 * composite foreign keys keep learner, class and placement inside one school.
 * The server-only secret key is deliberately NOT used here: nothing in this
 * workflow needs to bypass RLS (docs/AGENTS.md 4, docs/DECISIONS.md D-018,
 * D-028).
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

/**
 * The full record, fetched one learner at a time for the correction form. The
 * extra personal fields are deliberately not part of the list query, so the
 * list response carries only what the list needs (docs/SECURITY_AND_PRIVACY.md
 * 4, docs/AGENTS.md 7).
 */
const LEARNER_DETAIL_COLUMNS = `${LEARNER_COLUMNS}, residential_address, guardian_phone, guardian_email`;

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

/** The classes of one school, for the placement selector and the class list. */
export async function listClasses(
  supabase: ServerClient,
  schoolId: string,
  options: { readonly includeInactive?: boolean } = {},
): Promise<ClassSummary[] | null> {
  let query = supabase
    .from("classes")
    .select("id, name, is_active")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    return null;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    isActive: row.is_active as boolean,
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
 *
 * `status` defaults to `active`: inactive records are not part of routine
 * operational views, so reaching them is an explicit, permission-checked choice
 * (D-023).
 */
export async function listLearners(
  supabase: ServerClient,
  schoolId: string,
  page: number,
  status: LearnerStatus | "all" = "active",
  search?: string,
  classId?: string,
): Promise<LearnerPage | null> {
  const size = LEARNER_PAGE_SIZE;
  const from = (page - 1) * size;
  const to = from + size - 1;

  let query = supabase
    .from("learners")
    .select(LEARNER_COLUMNS, { count: "exact" })
    .eq("school_id", schoolId);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  // Optional class filter: only learners whose current placement is in that class.
  if (classId) {
    const { data: placements, error: placementError } = await supabase
      .from("learner_class_placements")
      .select("learner_id")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .is("ended_at", null);
    if (placementError) {
      return null;
    }
    const ids = (placements ?? []).map((row) => row.learner_id as string);
    if (ids.length === 0) {
      return { learners: [], page, pageSize: size, total: 0 };
    }
    query = query.in("id", ids);
  }

  // Optional name/username/registration-number search.
  const term = (search ?? "").trim();
  if (term.length > 0) {
    const safe = term.replace(/[%_]/g, "");
    if (safe.length > 0) {
      query = query.or(
        `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,username.ilike.%${safe}%,registration_number.ilike.%${safe}%`,
      );
    }
  }

  const { data, error, count } = await query
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
 * One learner's full record, for the correction form (`learner.read`).
 *
 * Fetched individually rather than added to the list so the paged list does not
 * carry every child's address and guardian contact details
 * (docs/SECURITY_AND_PRIVACY.md 4).
 */
export async function getLearnerDetail(
  supabase: ServerClient,
  schoolId: string,
  learnerId: string,
): Promise<LearnerDetail | null> {
  const { data } = await supabase
    .from("learners")
    .select(LEARNER_DETAIL_COLUMNS)
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .maybeSingle<
      RawLearner & {
        residential_address: string;
        guardian_phone: string;
        guardian_email: string | null;
      }
    >();

  if (!data) {
    return null;
  }

  const placements = await currentPlacements(supabase, [data.id]);
  return {
    ...toSummary(data, placements.get(data.id)),
    residentialAddress: data.residential_address,
    guardianPhone: data.guardian_phone,
    guardianEmail: data.guardian_email,
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

/* ------------------------------------------------------------------------- *
 * Phase 3 administration operations (D-028)
 *
 * Same rules as above: they run on the caller's session client, every statement
 * is scoped to the resolved school, and the permission is checked by the route
 * before the operation is called. Row Level Security is the real boundary.
 * ------------------------------------------------------------------------- */

const CLASS_NAME_TAKEN_MESSAGE =
  "A class with that name already exists in your school.";
const CLASS_WRITE_FAILED_MESSAGE =
  "That change could not be saved. Please try again.";
const LEARNER_NOT_FOUND_MESSAGE = "That student does not exist in your school.";
const LEARNER_WRITE_FAILED_MESSAGE =
  "That change could not be saved. Please try again.";

export type ClassWriteResult =
  | { readonly ok: true; readonly klass: ClassSummary }
  | {
      readonly ok: false;
      readonly reason: "duplicate" | "other";
      readonly message: string;
    };

export type ClassUpdateResult =
  | { readonly ok: true; readonly klass: ClassSummary }
  | {
      readonly ok: false;
      readonly reason: "not_found" | "duplicate" | "other";
      readonly message: string;
    };

export type LearnerWriteResult =
  | { readonly ok: true; readonly learner: LearnerSummary }
  | {
      readonly ok: false;
      readonly reason: "not_found" | "duplicate" | "other";
      readonly message: string;
    };

export type PlacementChangeResult =
  | {
      readonly ok: true;
      readonly learner: LearnerSummary;
      /** True when the student was already in the requested class. */
      readonly unchanged: boolean;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "learner_not_found"
        | "class_not_found"
        | "learner_inactive"
        | "conflict"
        | "other";
      readonly message: string;
    };

interface RawClass {
  id: string;
  name: string;
  is_active: boolean;
}

function toClassSummary(row: RawClass): ClassSummary {
  return { id: row.id, name: row.name, isActive: row.is_active };
}

/** Loads one learner of the school in the shared summary shape. */
async function loadLearnerSummary(
  supabase: ServerClient,
  schoolId: string,
  learnerId: string,
): Promise<LearnerSummary | null> {
  const { data } = await supabase
    .from("learners")
    .select(LEARNER_COLUMNS)
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .maybeSingle<RawLearner>();

  if (!data) {
    return null;
  }

  const placements = await currentPlacements(supabase, [data.id]);
  return toSummary(data, placements.get(data.id));
}

/**
 * Whether another class in the school already uses `name`, compared
 * case-insensitively so "Primary 1" and "primary 1" are not both created
 * (docs/ENROLMENT_PERMISSION_MODEL.md 5.3). `null` means the existing classes
 * could not be read, which the caller treats as a failed operation.
 *
 * The database constraint `classes_school_name_key` is exact-match and also
 * covers inactive classes, so it is a backstop rather than the only guard: a
 * deactivated class keeps its name reserved until it is renamed.
 */
async function isClassNameTaken(
  supabase: ServerClient,
  schoolId: string,
  name: string,
  exceptClassId?: string,
): Promise<boolean | null> {
  const classes = await listClasses(supabase, schoolId, {
    includeInactive: true,
  });
  if (classes === null) {
    return null;
  }
  const target = name.trim().toLowerCase();
  return classes.some(
    (klass) =>
      klass.id !== exceptClassId && klass.name.trim().toLowerCase() === target,
  );
}

/** Creates a class in the caller's school (`class.manage`). */
export async function createClass(params: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly name: string;
}): Promise<ClassWriteResult> {
  const { supabase, schoolId, name } = params;

  const taken = await isClassNameTaken(supabase, schoolId, name);
  if (taken === null) {
    return { ok: false, reason: "other", message: CLASS_WRITE_FAILED_MESSAGE };
  }
  if (taken) {
    return {
      ok: false,
      reason: "duplicate",
      message: CLASS_NAME_TAKEN_MESSAGE,
    };
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({ school_id: schoolId, name })
    .select("id, name, is_active")
    .single<RawClass>();

  if (error || !data) {
    if (
      errorCode(error) === "23505" &&
      errorText(error).includes("classes_school_name_key")
    ) {
      return {
        ok: false,
        reason: "duplicate",
        message: CLASS_NAME_TAKEN_MESSAGE,
      };
    }
    return { ok: false, reason: "other", message: CLASS_WRITE_FAILED_MESSAGE };
  }

  return { ok: true, klass: toClassSummary(data) };
}

/**
 * Renames a class and/or sets its active flag (`class.manage`). A class is
 * never deleted: `learner_class_placements` references it with `ON DELETE
 * RESTRICT`, and past placements stay interpretable (D-023, 5.3).
 */
export async function updateClass(params: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly classId: string;
  readonly name?: string;
  readonly isActive?: boolean;
}): Promise<ClassUpdateResult> {
  const { supabase, schoolId, classId, name, isActive } = params;

  const classes = await listClasses(supabase, schoolId, {
    includeInactive: true,
  });
  if (classes === null) {
    return { ok: false, reason: "other", message: CLASS_WRITE_FAILED_MESSAGE };
  }

  const current = classes.find((klass) => klass.id === classId);
  if (!current) {
    return {
      ok: false,
      reason: "not_found",
      message: "That class does not exist in your school.",
    };
  }

  const nextName = name ?? current.name;
  const nextActive = isActive ?? current.isActive;

  if (name !== undefined) {
    const taken = classes.some(
      (klass) =>
        klass.id !== classId &&
        klass.name.trim().toLowerCase() === nextName.trim().toLowerCase(),
    );
    if (taken) {
      return {
        ok: false,
        reason: "duplicate",
        message: CLASS_NAME_TAKEN_MESSAGE,
      };
    }
  }

  // Nothing actually changes: report success without a write, so no empty
  // audit event is appended by the `classes` trigger.
  if (nextName === current.name && nextActive === current.isActive) {
    return { ok: true, klass: current };
  }

  const patch: { name?: string; is_active?: boolean } = {};
  if (name !== undefined) {
    patch.name = nextName;
  }
  if (isActive !== undefined) {
    patch.is_active = nextActive;
  }

  const { data, error } = await supabase
    .from("classes")
    .update(patch)
    .eq("id", classId)
    .eq("school_id", schoolId)
    .select("id, name, is_active")
    .maybeSingle<RawClass>();

  if (error) {
    if (
      errorCode(error) === "23505" &&
      errorText(error).includes("classes_school_name_key")
    ) {
      return {
        ok: false,
        reason: "duplicate",
        message: CLASS_NAME_TAKEN_MESSAGE,
      };
    }
    return { ok: false, reason: "other", message: CLASS_WRITE_FAILED_MESSAGE };
  }

  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: "That class does not exist in your school.",
    };
  }

  return { ok: true, klass: toClassSummary(data) };
}

/**
 * Applies a partial correction to a learner (`learner.update`). Only the
 * columns the caller actually sent are written, so a correction cannot blank an
 * unrelated field. The username is deliberately not derived again: it is the
 * stable sign-in identifier (ENROLMENT_PERMISSION_MODEL 7), not a display name.
 * The `learners` audit trigger records the changed columns (D-023, 5.4).
 */
export async function correctLearner(params: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly input: LearnerCorrectionInput;
}): Promise<LearnerWriteResult> {
  const { supabase, schoolId, input } = params;

  const patch: Record<string, string | null> = {};
  if (input.registrationNumber !== undefined) {
    patch.registration_number = input.registrationNumber;
  }
  if (input.firstName !== undefined) {
    patch.first_name = input.firstName;
  }
  if (input.lastName !== undefined) {
    patch.last_name = input.lastName;
  }
  if (input.gender !== undefined) {
    patch.gender = input.gender;
  }
  if (input.dateOfBirth !== undefined) {
    patch.date_of_birth = input.dateOfBirth;
  }
  if (input.residentialAddress !== undefined) {
    patch.residential_address = input.residentialAddress;
  }
  if (input.guardianPhone !== undefined) {
    patch.guardian_phone = input.guardianPhone;
  }
  if (input.guardianEmail !== undefined) {
    patch.guardian_email = input.guardianEmail;
  }

  const { data, error } = await supabase
    .from("learners")
    .update(patch)
    .eq("id", input.learnerId)
    .eq("school_id", schoolId)
    .select(LEARNER_COLUMNS)
    .maybeSingle<RawLearner>();

  if (error) {
    if (
      errorCode(error) === "23505" &&
      errorText(error).includes("learners_school_registration_key")
    ) {
      return {
        ok: false,
        reason: "duplicate",
        message: "That registration number is already used in your school.",
      };
    }
    return {
      ok: false,
      reason: "other",
      message: LEARNER_WRITE_FAILED_MESSAGE,
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: LEARNER_NOT_FOUND_MESSAGE,
    };
  }

  const placements = await currentPlacements(supabase, [data.id]);
  return { ok: true, learner: toSummary(data, placements.get(data.id)) };
}

/**
 * Activates or deactivates a learner (`learner.update`). Deactivation is a
 * state change, never a delete (D-023, 5.2); the `learners` audit trigger
 * records it. Setting the status that is already in force is a no-op, so a
 * repeated request does not append an empty audit event.
 */
export async function setLearnerStatus(params: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly learnerId: string;
  readonly status: LearnerStatus;
}): Promise<LearnerWriteResult> {
  const { supabase, schoolId, learnerId, status } = params;

  const { data: current } = await supabase
    .from("learners")
    .select(LEARNER_COLUMNS)
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .maybeSingle<RawLearner>();

  if (!current) {
    return {
      ok: false,
      reason: "not_found",
      message: LEARNER_NOT_FOUND_MESSAGE,
    };
  }

  if (current.status === status) {
    const placements = await currentPlacements(supabase, [current.id]);
    return {
      ok: true,
      learner: toSummary(current, placements.get(current.id)),
    };
  }

  const { data, error } = await supabase
    .from("learners")
    .update({ status })
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .select(LEARNER_COLUMNS)
    .maybeSingle<RawLearner>();

  if (error || !data) {
    return {
      ok: false,
      reason: "other",
      message: LEARNER_WRITE_FAILED_MESSAGE,
    };
  }

  const placements = await currentPlacements(supabase, [data.id]);
  return { ok: true, learner: toSummary(data, placements.get(data.id)) };
}

/**
 * Moves a learner to another class (`learner.placement.manage`).
 *
 * One open placement per learner is guaranteed by the partial unique index
 * `placements_one_current_per_learner`, so the previous placement is ended
 * before the new one is inserted. If the insert then fails, the student is
 * temporarily unplaced and repeating the request places them; the index makes
 * two concurrent changes resolve to one winner and one `409`.
 *
 * The new placement starts at the instant the previous one ends, so the history
 * stays contiguous, and `ended_at` is never earlier than `started_at` (the
 * `placements_period_check` constraint), even if the application clock is
 * behind the database clock.
 */
export async function changePlacement(params: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly userId: string;
  readonly learnerId: string;
  readonly classId: string;
}): Promise<PlacementChangeResult> {
  const { supabase, schoolId, userId, learnerId, classId } = params;

  const { data: learner } = await supabase
    .from("learners")
    .select("id, status")
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .maybeSingle<{ id: string; status: string }>();

  if (!learner) {
    return {
      ok: false,
      reason: "learner_not_found",
      message: LEARNER_NOT_FOUND_MESSAGE,
    };
  }

  if (learner.status !== "active") {
    return {
      ok: false,
      reason: "learner_inactive",
      message:
        "That student is inactive. Reactivate them before changing their class.",
    };
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle<{ id: string; name: string }>();

  if (!klass) {
    return {
      ok: false,
      reason: "class_not_found",
      message: "That class is not available in your school.",
    };
  }

  const { data: open } = await supabase
    .from("learner_class_placements")
    .select("id, class_id, started_at")
    .eq("learner_id", learnerId)
    .is("ended_at", null)
    .maybeSingle<{ id: string; class_id: string; started_at: string }>();

  if (open && open.class_id === classId) {
    const summary = await loadLearnerSummary(supabase, schoolId, learnerId);
    if (!summary) {
      return {
        ok: false,
        reason: "other",
        message: LEARNER_WRITE_FAILED_MESSAGE,
      };
    }
    return { ok: true, learner: summary, unchanged: true };
  }

  // End the current placement first: if the insert below fails, the student is
  // unplaced rather than double-placed, and a retry completes the change.
  let newStartedAt: string | undefined;
  if (open) {
    const nowMs = Date.now();
    const startMs = Date.parse(open.started_at);
    const endedMs =
      Number.isFinite(startMs) && nowMs <= startMs ? startMs + 1 : nowMs;
    const endedAt = new Date(endedMs).toISOString();
    newStartedAt = endedAt;

    const { error: endError } = await supabase
      .from("learner_class_placements")
      .update({ ended_at: endedAt })
      .eq("id", open.id)
      .eq("school_id", schoolId);

    if (endError) {
      return {
        ok: false,
        reason: "other",
        message: LEARNER_WRITE_FAILED_MESSAGE,
      };
    }
  }

  const { error: insertError } = await supabase
    .from("learner_class_placements")
    .insert({
      school_id: schoolId,
      learner_id: learnerId,
      class_id: classId,
      created_by: userId,
      ...(newStartedAt ? { started_at: newStartedAt } : {}),
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    if (
      errorCode(insertError) === "23505" &&
      errorText(insertError).includes("placements_one_current_per_learner")
    ) {
      return {
        ok: false,
        reason: "conflict",
        message:
          "That student's class was changed by someone else. Reload and try again.",
      };
    }
    return {
      ok: false,
      reason: "other",
      message:
        "The class change could not be saved. Reload and try again; the student may be shown without a class until it succeeds.",
    };
  }

  const summary = await loadLearnerSummary(supabase, schoolId, learnerId);
  if (!summary) {
    return {
      ok: false,
      reason: "other",
      message: LEARNER_WRITE_FAILED_MESSAGE,
    };
  }

  return { ok: true, learner: summary, unchanged: false };
}
