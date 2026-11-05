import type { NextResponse } from "next/server";

import { parseRegisterSubmitInput } from "@/lib/attendance/requests";
import { getRegister, submitRegister } from "@/lib/server/attendance";
import { utcToday } from "@/lib/dates";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A class register (D-030).
 *
 * `GET` reads the roster and what has been marked, behind `attendance.read`;
 * `POST` writes the whole register, behind `attendance.record` for a first
 * submission and `attendance.correct` for changing one.
 *
 * The roster comes from the `class_roster` function, so a teacher can mark a
 * register without holding `learner.read`; it returns id, registration number
 * and name only.
 *
 * The correction window is a business rule, enforced in the server operation: a
 * teacher may change a register while the session date is today, and only a
 * holder of `attendance.report` (an administrator) may correct an earlier one.
 * A session the caller cannot reach is a `404`, never a hint that it exists.
 */

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  closed_for_teacher: 409,
  other: 500,
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "attendance.record");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseRegisterSubmitInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  // Closed-period lock: block mutations on closed terms.
  const { isTermClosed } = await import("@/lib/server/administration");
  const { data: sessionRow } = await supabase
    .from("attendance_sessions")
    .select("term_id")
    .eq("id", parsed.value.sessionId)
    .eq("school_id", access.schoolId)
    .maybeSingle<{ term_id: string | null }>();
  if (sessionRow?.term_id && (await isTermClosed(supabase, access.schoolId, sessionRow.term_id))) {
    return json(
      { ok: false, error: "This term is closed. Attendance edits are not allowed." },
      403,
    );
  }

  const today = utcToday();
  const canCorrectAnyDate = await hasSchoolPermission(
    supabase,
    access.schoolId,
    "attendance.report",
  );

  // A correction needs attendance.correct, which `attendance.record` alone does
  // not imply. Only a holder of it may change marks that already exist, so this
  // is checked here rather than being assumed from the permission used above.
  const isCorrection = await registerAlreadyHasMarks(
    supabase,
    access.schoolId,
    parsed.value.sessionId,
  );
  if (isCorrection) {
    const mayCorrect = await hasSchoolPermission(
      supabase,
      access.schoolId,
      "attendance.correct",
    );
    if (!mayCorrect) {
      return json({ ok: false, error: "Not permitted." }, 403);
    }
  }

  const result = await submitRegister({
    supabase,
    schoolId: access.schoolId,
    sessionId: parsed.value.sessionId,
    entries: parsed.value.entries.map((entry) => ({
      learnerId: entry.learnerId,
      status: entry.status,
      note: entry.note,
    })),
    canCorrectAnyDate,
    today,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, detail: result.detail });
}

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "attendance.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId === null || sessionId.trim().length === 0) {
    return json({ ok: false, error: "Choose a session." }, 400);
  }

  const canCorrectAnyDate = await hasSchoolPermission(
    supabase,
    access.schoolId,
    "attendance.report",
  );

  const result = await getRegister({
    supabase,
    schoolId: access.schoolId,
    sessionId: sessionId.trim(),
    canCorrectAnyDate,
    today: utcToday(),
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, detail: result.detail });
}

/** Whether any mark already exists for the session, i.e. this is a correction. */
async function registerAlreadyHasMarks(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("school_id", schoolId)
    .eq("session_id", sessionId)
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

/** Whether the caller holds `permission` in their own school. Fails closed. */
async function hasSchoolPermission(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  permission: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_school_permission", {
    target_school_id: schoolId,
    required_permission: permission,
  });
  return !error && data === true;
}
