import "server-only";

import type {
  AcademicYearSummary,
  SchoolProfile,
  StaffAssignmentSummary,
  SubjectSummary,
  TermSummary,
} from "@/lib/administration/types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Trusted Phase 3 administration operations (D-029): the school profile,
 * academic years and terms, subjects, and staff assignments.
 *
 * Every read and write runs on the caller's *session* client, exactly like the
 * enrolment operations (D-018, D-028). The school id is resolved from the
 * caller's own membership before these are called, so Row Level Security — not
 * this module — is the enforcement boundary: a cross-school id simply matches no
 * row, and a caller without the required permission is refused by the policy.
 *
 * Membership *status* changes (suspend / restore / revoke) live in
 * `staff-members.ts` because listing members needs the server-only secret key to
 * resolve account emails.
 */

export type FailureReason = "not_found" | "duplicate" | "invalid" | "other";

export interface Failure {
  readonly ok: false;
  readonly reason: FailureReason;
  readonly message: string;
}

/** Maps a PostgreSQL error code onto a caller-facing reason. */
function classify(error: unknown): "duplicate" | "invalid" | "other" {
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

// ---------------------------------------------------------------------------
// School profile
// ---------------------------------------------------------------------------

export async function getSchoolProfile(
  supabase: ServerClient,
  schoolId: string,
): Promise<SchoolProfile | null> {
  const { data, error } = await supabase
    .from("schools")
    .select(
      "id, name, code, status, physical_address, primary_phone, secondary_phone, official_email, website, logo_url",
    )
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return {
    id: data.id as string,
    name: data.name as string,
    code: data.code as string,
    status: data.status as string,
    physicalAddress: (data.physical_address as string | null) ?? null,
    primaryPhone: (data.primary_phone as string | null) ?? null,
    secondaryPhone: (data.secondary_phone as string | null) ?? null,
    officialEmail: (data.official_email as string | null) ?? null,
    website: (data.website as string | null) ?? null,
    logoUrl: (data.logo_url as string | null) ?? null,
  };
}

export type UpdateSchoolProfileResult =
  | { readonly ok: true; readonly school: SchoolProfile }
  | {
      readonly ok: false;
      readonly reason: "not_found" | "invalid" | "other";
      readonly message: string;
    };

export async function updateSchoolProfile(options: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly name: string;
  readonly physicalAddress?: string | null;
  readonly primaryPhone?: string | null;
  readonly secondaryPhone?: string | null;
  readonly officialEmail?: string | null;
  readonly website?: string | null;
  readonly logoUrl?: string | null;
}): Promise<UpdateSchoolProfileResult> {
  const {
    supabase,
    schoolId,
    name,
    physicalAddress,
    primaryPhone,
    secondaryPhone,
    officialEmail,
    website,
    logoUrl,
  } = options;

  const { data, error } = await supabase
    .from("schools")
    .update({
      name,
      physical_address: physicalAddress,
      primary_phone: primaryPhone,
      secondary_phone: secondaryPhone,
      official_email: officialEmail,
      website,
      logo_url: logoUrl,
    })
    .eq("id", schoolId)
    .select(
      "id, name, code, status, physical_address, primary_phone, secondary_phone, official_email, website, logo_url",
    )
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: error.code === "23514" ? "invalid" : "other",
      message: "The school could not be updated.",
    };
  }
  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: "The school could not be updated.",
    };
  }

  return {
    ok: true,
    school: {
      id: data.id as string,
      name: data.name as string,
      code: data.code as string,
      status: data.status as string,
      physicalAddress: (data.physical_address as string | null) ?? null,
      primaryPhone: (data.primary_phone as string | null) ?? null,
      secondaryPhone: (data.secondary_phone as string | null) ?? null,
      officialEmail: (data.official_email as string | null) ?? null,
      website: (data.website as string | null) ?? null,
      logoUrl: (data.logo_url as string | null) ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Academic years and terms
// ---------------------------------------------------------------------------

interface TermRow {
  readonly id: string;
  readonly name: string;
  readonly starts_on: string;
  readonly ends_on: string;
  readonly is_current: boolean;
  readonly status: string;
  readonly vacation_start: string | null;
  readonly vacation_end: string | null;
  readonly exam_start: string | null;
  readonly exam_end: string | null;
}
interface AcademicYearRow {
  readonly id: string;
  readonly name: string;
  readonly starts_on: string;
  readonly ends_on: string;
  readonly is_current: boolean;
  readonly status: string;
  readonly is_active: boolean;
  readonly terms: TermRow[] | null;
}

function toTerm(row: TermRow): TermSummary {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isCurrent: row.is_current,
    status: row.status,
    vacationStart: row.vacation_start,
    vacationEnd: row.vacation_end,
    examStart: row.exam_start,
    examEnd: row.exam_end,
  };
}

function toAcademicYear(row: AcademicYearRow): AcademicYearSummary {
  const terms = (row.terms ?? []).map(toTerm);
  terms.sort((a, b) =>
    a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0,
  );
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isCurrent: row.is_current,
    status: row.status,
    isActive: row.is_active,
    terms,
  };
}

/** Lists a school's academic years, newest first, each with its terms. */
export async function listAcademicYears(
  supabase: ServerClient,
  schoolId: string,
): Promise<AcademicYearSummary[] | null> {
  const { data, error } = await supabase
    .from("academic_years")
    .select(
      "id, name, starts_on, ends_on, is_current, status, is_active, terms ( id, name, starts_on, ends_on, is_current, status, vacation_start, vacation_end, exam_start, exam_end )",
    )
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: false });

  if (error || !data) {
    return null;
  }
  return (data as AcademicYearRow[]).map(toAcademicYear);
}

export type AcademicYearResult =
  | { readonly ok: true; readonly academicYear: AcademicYearSummary }
  | {
      readonly ok: false;
      readonly reason: "not_found" | "duplicate" | "invalid" | "other";
      readonly message: string;
    };

function failureMessage(
  reason: "not_found" | "duplicate" | "invalid" | "other",
  subject: string,
): string {
  switch (reason) {
    case "duplicate":
      return `${subject} with that name already exists.`;
    case "invalid":
      return `That ${subject.toLowerCase()} is not valid.`;
    case "not_found":
      return `The ${subject.toLowerCase()} could not be found.`;
    default:
      return `The ${subject.toLowerCase()} could not be saved.`;
  }
}

export async function createAcademicYear(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
}): Promise<AcademicYearResult> {
  const { data, error } = await input.supabase
    .from("academic_years")
    .insert({
      school_id: input.schoolId,
      name: input.name,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .select("id, name, starts_on, ends_on, is_current, status, is_active")
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return {
      ok: false,
      reason,
      message: failureMessage(reason, "Academic year"),
    };
  }
  return {
    ok: true,
    academicYear: toAcademicYear({ ...(data as AcademicYearRow), terms: [] }),
  };
}

export async function updateAcademicYear(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly name?: string;
  readonly startsOn?: string;
  readonly endsOn?: string;
  readonly isCurrent?: boolean;
  readonly status?: string;
}): Promise<AcademicYearResult> {
  const { supabase, schoolId, academicYearId } = input;

  // At most one current year per school (migration 0005). Clearing the previous
  // current row first keeps the partial unique index satisfied.
  if (input.isCurrent === true) {
    const { error: clearError } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .neq("id", academicYearId);
    if (clearError) {
      return {
        ok: false,
        reason: "other",
        message: "The academic year could not be updated.",
      };
    }
  }

  // When activating, also set status to ACTIVE and deactivate other active years
  if (input.status === "ACTIVE") {
    const { error: clearError } = await supabase
      .from("academic_years")
      .update({ status: "UPCOMING", is_active: false })
      .eq("school_id", schoolId)
      .eq("status", "ACTIVE")
      .neq("id", academicYearId);
    if (clearError) {
      return {
        ok: false,
        reason: "other",
        message: "The academic year could not be updated.",
      };
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.startsOn !== undefined) patch.starts_on = input.startsOn;
  if (input.endsOn !== undefined) patch.ends_on = input.endsOn;
  if (input.isCurrent !== undefined) patch.is_current = input.isCurrent;
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.is_active = input.status === "ACTIVE";
  }

  const { data, error } = await supabase
    .from("academic_years")
    .update(patch)
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .select(
      "id, name, starts_on, ends_on, is_current, status, is_active, terms ( id, name, starts_on, ends_on, is_current, status, vacation_start, vacation_end, exam_start, exam_end )",
    )
    .maybeSingle();

  if (error) {
    const reason = classify(error);
    return {
      ok: false,
      reason,
      message: failureMessage(reason, "Academic year"),
    };
  }
  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Academic year"),
    };
  }
  return { ok: true, academicYear: toAcademicYear(data as AcademicYearRow) };
}

export type TermResult =
  | { readonly ok: true; readonly term: TermSummary }
  | {
      readonly ok: false;
      readonly reason: "not_found" | "duplicate" | "invalid" | "other";
      readonly message: string;
    };

export async function createTerm(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
}): Promise<TermResult> {
  const { data, error } = await input.supabase
    .from("terms")
    .insert({
      school_id: input.schoolId,
      academic_year_id: input.academicYearId,
      name: input.name,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .select("id, name, starts_on, ends_on, is_current, status, vacation_start, vacation_end, exam_start, exam_end")
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Term") };
  }
  return { ok: true, term: toTerm(data as TermRow) };
}

export async function updateTerm(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly termId: string;
  readonly name?: string;
  readonly startsOn?: string;
  readonly endsOn?: string;
  readonly isCurrent?: boolean;
  readonly status?: string;
  readonly vacationStart?: string | null;
  readonly vacationEnd?: string | null;
  readonly examStart?: string | null;
  readonly examEnd?: string | null;
}): Promise<TermResult> {
  const { supabase, schoolId, termId } = input;

  // At most one current term per school. Clear previous first.
  if (input.isCurrent === true) {
    const { error: clearError } = await supabase
      .from("terms")
      .update({ is_current: false })
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .neq("id", termId);
    if (clearError) {
      return {
        ok: false,
        reason: "other",
        message: "The term could not be updated.",
      };
    }
  }

  // When activating, deactivate other active terms
  if (input.status === "ACTIVE") {
    const { error: clearError } = await supabase
      .from("terms")
      .update({ status: "UPCOMING", is_current: false })
      .eq("school_id", schoolId)
      .eq("status", "ACTIVE")
      .neq("id", termId);
    if (clearError) {
      return {
        ok: false,
        reason: "other",
        message: "The term could not be updated.",
      };
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.startsOn !== undefined) patch.starts_on = input.startsOn;
  if (input.endsOn !== undefined) patch.ends_on = input.endsOn;
  if (input.isCurrent !== undefined) patch.is_current = input.isCurrent;
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "ACTIVE") patch.is_current = true;
    if (input.status === "CLOSED") patch.is_current = false;
  }
  if (input.vacationStart !== undefined) patch.vacation_start = input.vacationStart;
  if (input.vacationEnd !== undefined) patch.vacation_end = input.vacationEnd;
  if (input.examStart !== undefined) patch.exam_start = input.examStart;
  if (input.examEnd !== undefined) patch.exam_end = input.examEnd;

  const { data, error } = await supabase
    .from("terms")
    .update(patch)
    .eq("id", termId)
    .eq("school_id", schoolId)
    .select("id, name, starts_on, ends_on, is_current, status, vacation_start, vacation_end, exam_start, exam_end")
    .maybeSingle();

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Term") };
  }
  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Term"),
    };
  }
  return { ok: true, term: toTerm(data as TermRow) };
}

// ---------------------------------------------------------------------------
// Closed-period lock check
// ---------------------------------------------------------------------------

/**
 * Returns true when the given term is CLOSED, meaning no mutations should be
 * allowed on assessment results or attendance for that period.
 */
export async function isTermClosed(
  supabase: ServerClient,
  schoolId: string,
  termId: string | null,
): Promise<boolean> {
  if (termId === null) {
    return false;
  }
  const { data } = await supabase
    .from("terms")
    .select("status")
    .eq("id", termId)
    .eq("school_id", schoolId)
    .maybeSingle<{ status: string }>();

  return data?.status === "CLOSED";
}

/**
 * Returns true when the given academic year is CLOSED.
 */
export async function isAcademicYearClosed(
  supabase: ServerClient,
  schoolId: string,
  academicYearId: string | null,
): Promise<boolean> {
  if (academicYearId === null) {
    return false;
  }
  const { data } = await supabase
    .from("academic_years")
    .select("status")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .maybeSingle<{ status: string }>();

  return data?.status === "CLOSED";
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

interface SubjectRow {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly is_active: boolean;
  readonly is_compulsory: boolean;
}

function toSubject(row: SubjectRow): SubjectSummary {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
    is_compulsory: row.is_compulsory,
  };
}

export async function listSubjects(
  supabase: ServerClient,
  schoolId: string,
): Promise<SubjectSummary[] | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, code, is_active, is_compulsory")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (error || !data) {
    return null;
  }
  return (data as SubjectRow[]).map(toSubject);
}

export type SubjectResult =
  | { readonly ok: true; readonly subject: SubjectSummary }
  | {
      readonly ok: false;
      readonly reason: "not_found" | "duplicate" | "invalid" | "other";
      readonly message: string;
    };

export async function createSubject(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly name: string;
  readonly code: string | null;
}): Promise<SubjectResult> {
  const { data, error } = await input.supabase
    .from("subjects")
    .insert({
      school_id: input.schoolId,
      name: input.name,
      code: input.code,
    })
    .select("id, name, code, is_active")
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Subject") };
  }
  return { ok: true, subject: toSubject(data as SubjectRow) };
}

export async function updateSubject(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly subjectId: string;
  readonly name?: string;
  readonly code?: string | null;
  readonly isActive?: boolean;
}): Promise<SubjectResult> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.code !== undefined) patch.code = input.code;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await input.supabase
    .from("subjects")
    .update(patch)
    .eq("id", input.subjectId)
    .eq("school_id", input.schoolId)
    .select("id, name, code, is_active")
    .maybeSingle();

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Subject") };
  }
  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      message: failureMessage("not_found", "Subject"),
    };
  }
  return { ok: true, subject: toSubject(data as SubjectRow) };
}

// ---------------------------------------------------------------------------
// Staff assignments
// ---------------------------------------------------------------------------

interface AssignmentRow {
  readonly id: string;
  readonly membership_id: string;
  readonly class_id: string | null;
  readonly subject_id: string | null;
}

/** Raw assignments for a school; names are joined by the members operation. */
export async function listAssignmentRows(
  supabase: ServerClient,
  schoolId: string,
): Promise<
  | {
      readonly id: string;
      readonly membershipId: string;
      readonly classId: string | null;
      readonly subjectId: string | null;
    }[]
  | null
> {
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("id, membership_id, class_id, subject_id")
    .eq("school_id", schoolId);

  if (error || !data) {
    return null;
  }
  return (data as AssignmentRow[]).map((row) => ({
    id: row.id,
    membershipId: row.membership_id,
    classId: row.class_id,
    subjectId: row.subject_id,
  }));
}

export type AssignmentResult =
  | { readonly ok: true; readonly assignmentId: string }
  | {
      readonly ok: false;
      readonly reason: "not_found" | "duplicate" | "invalid" | "other";
      readonly message: string;
    };

export async function createAssignment(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly membershipId: string;
  readonly classId: string | null;
  readonly subjectId: string | null;
}): Promise<AssignmentResult> {
  const { data, error } = await input.supabase
    .from("staff_assignments")
    .insert({
      school_id: input.schoolId,
      membership_id: input.membershipId,
      class_id: input.classId,
      subject_id: input.subjectId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Assignment") };
  }
  return { ok: true, assignmentId: (data as { id: string }).id };
}

export async function deleteAssignment(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly assignmentId: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly message: string }
> {
  const { data, error } = await input.supabase
    .from("staff_assignments")
    .delete()
    .eq("id", input.assignmentId)
    .eq("school_id", input.schoolId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: "The assignment could not be removed." };
  }
  if (!data) {
    return { ok: false, message: "That assignment no longer exists." };
  }
  return { ok: true };
}

/** Exposed for the members operation to reuse the view shape. */
export type { StaffAssignmentSummary };
