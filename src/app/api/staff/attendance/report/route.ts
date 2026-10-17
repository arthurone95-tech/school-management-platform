import type { NextResponse } from "next/server";

import { parseReportQuery } from "@/lib/attendance/requests";
import { buildClassReport } from "@/lib/server/attendance";
import { utcToday } from "@/lib/dates";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Per-class attendance report (D-030).
 *
 * Behind `attendance.report`, which is granted to `school_administrator` only:
 * this is the school-wide view, and a teacher's attendance permissions must not
 * extend to it. It aggregates the statuses over a bounded window (at most
 * `ATTENDANCE_MAX_REPORT_DAYS`), which is what keeps the query bounded rather
 * than scanning a school's whole attendance history (docs/AGENTS.md 6).
 *
 * The counts are computed from rows the caller's own session client can read. A
 * class outside their school is simply invisible to it, so the report cannot
 * disclose another school's attendance.
 */

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "attendance.report");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const parsed = parseReportQuery(
    new URL(request.url).searchParams,
    utcToday(),
  );
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const report = await buildClassReport({
    supabase,
    schoolId: access.schoolId,
    classId: parsed.value.classId,
    from: parsed.value.from,
    to: parsed.value.to,
  });

  if (report === null) {
    return json({ ok: false, error: "The report could not be built." }, 404);
  }

  return json({ ok: true, report });
}
