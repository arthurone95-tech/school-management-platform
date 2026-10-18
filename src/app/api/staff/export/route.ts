import { NextResponse } from "next/server";

import {
  exportClassAttendance,
  exportClassResults,
  exportLearners,
} from "@/lib/server/dataexchange";
import { isIsoDate } from "@/lib/dates";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * CSV export of the school's data (D-032).
 *
 * Three exports, all administrator-only and all **audited by the database**:
 *
 *   * `?kind=learners` — the whole roll, with the current class. Requires
 *     `learner.export`.
 *   * `?kind=attendance&classId=…&from=…&to=…` — one class's registers over a
 *     window. Requires `report.export`.
 *   * `?kind=results&classId=…&from=…&to=…` — one class's marks over a window.
 *     Requires `report.export`.
 *
 * An export is a disclosure of children's personal data, so it is gated on its
 * own permission rather than on `learner.read`, it is bounded, and it is written
 * to the audit trail by the database itself (migration 0010) so the actor cannot
 * be omitted or forged. The response is `text/csv` with a download filename, and
 * values are escaped so a spreadsheet cannot execute a cell as a formula.
 */

/** Longest window one export may cover, so a request stays bounded. */
const MAX_WINDOW_DAYS = 366;

function csvResponse(
  csv: string,
  filename: string,
  rowCount: number,
): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(rowCount),
    },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "learners";

  if (kind === "learners") {
    const access = await resolveSchoolAccess(supabase, "learner.export");
    if (!access.ok) {
      return json({ ok: false, error: access.message }, access.status);
    }

    const result = await exportLearners({
      supabase,
      schoolId: access.schoolId,
    });
    if (!result.ok) {
      return json({ ok: false, error: result.message }, 500);
    }
    return csvResponse(result.csv, result.filename, result.rowCount);
  }

  if (kind === "attendance" || kind === "results") {
    const access = await resolveSchoolAccess(supabase, "report.export");
    if (!access.ok) {
      return json({ ok: false, error: access.message }, access.status);
    }

    const classId = params.get("classId");
    if (classId === null || classId.trim().length === 0) {
      return json({ ok: false, error: "Choose a class." }, 400);
    }

    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (!isIsoDate(from) || !isIsoDate(to)) {
      return json(
        { ok: false, error: "Choose a valid start and end date (YYYY-MM-DD)." },
        400,
      );
    }
    if (to < from) {
      return json(
        {
          ok: false,
          error: "The end date must be on or after the start date.",
        },
        400,
      );
    }
    const days = Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    );
    if (days >= MAX_WINDOW_DAYS) {
      return json(
        {
          ok: false,
          error: `Choose a window of at most ${MAX_WINDOW_DAYS} days.`,
        },
        400,
      );
    }

    const result =
      kind === "attendance"
        ? await exportClassAttendance({
            supabase,
            schoolId: access.schoolId,
            classId: classId.trim(),
            from,
            to,
          })
        : await exportClassResults({
            supabase,
            schoolId: access.schoolId,
            classId: classId.trim(),
            from,
            to,
          });

    if (!result.ok) {
      return json({ ok: false, error: result.message }, 500);
    }
    return csvResponse(result.csv, result.filename, result.rowCount);
  }

  return json({ ok: false, error: "Choose what to export." }, 400);
}
