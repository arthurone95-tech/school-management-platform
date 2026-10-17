import type { NextResponse } from "next/server";

import {
  parseSessionCreateInput,
  parseSessionListQuery,
} from "@/lib/attendance/requests";
import { createSession, listSessions } from "@/lib/server/attendance";
import { utcToday } from "@/lib/dates";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Attendance sessions for a date (D-030).
 *
 * `GET` lists the sessions on a date behind `attendance.read`; `POST` opens one
 * behind `attendance.record`. The date defaults to today.
 *
 * A teacher only ever sees sessions for classes they are assigned to: the
 * listing is an ordinary read on the caller's session client, and the
 * `attendance_sessions_select_scoped` policy filters on `can_access_class`. The
 * school id comes from the caller's own membership, never from the request.
 */

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  closed_for_teacher: 409,
  other: 500,
};

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "attendance.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  // Holding attendance.report is what allows correcting any past date, so it is
  // checked rather than inferred from the role name.
  const canCorrectAnyDate = await hasSchoolPermission(
    supabase,
    access.schoolId,
    "attendance.report",
  );

  const today = utcToday();
  const parsed = parseSessionListQuery(
    new URL(request.url).searchParams,
    today,
  );
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const sessions = await listSessions({
    supabase,
    schoolId: access.schoolId,
    sessionDate: parsed.value.sessionDate,
    classId: parsed.value.classId,
    canCorrectAnyDate,
    today,
  });
  if (sessions === null) {
    return json({ ok: false, error: "The sessions could not be loaded." }, 500);
  }

  return json({ ok: true, sessions });
}

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

  const today = utcToday();
  const parsed = parseSessionCreateInput(body, today);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const canCorrectAnyDate = await hasSchoolPermission(
    supabase,
    access.schoolId,
    "attendance.report",
  );

  const result = await createSession({
    supabase,
    schoolId: access.schoolId,
    classId: parsed.value.classId,
    subjectId: parsed.value.subjectId,
    sessionDate: parsed.value.sessionDate,
    notes: parsed.value.notes,
    canCorrectAnyDate,
    today,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, session: result.session }, 201);
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
