import type { NextResponse } from "next/server";

import { parseGradeBandUpdateInput } from "@/lib/academics/requests";
import { deleteGradeBand, updateGradeBand } from "@/lib/server/academics";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Edits or removes a grade band (D-031), behind `grade.manage`.
 *
 * A band may be relabelled, re-marked as passing or not, or removed. Removing
 * one cannot rewrite history: a stored result keeps its score and percentage, so
 * removing a band only changes future grading.
 */

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  other: 500,
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "grade.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const isDelete = (body as { action?: unknown } | null)?.action === "delete";

  if (isDelete) {
    const bandId = (body as { bandId?: unknown }).bandId;
    if (typeof bandId !== "string" || bandId.length === 0) {
      return json({ ok: false, error: "Invalid request body." }, 400);
    }

    const removed = await deleteGradeBand({
      supabase,
      schoolId: access.schoolId,
      bandId,
    });
    if (!removed.ok) {
      return json(
        { ok: false, error: removed.message },
        REASON_STATUS[removed.reason] ?? 500,
      );
    }
    return json({ ok: true });
  }

  const parsed = parseGradeBandUpdateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateGradeBand({
    supabase,
    schoolId: access.schoolId,
    bandId: parsed.value.bandId,
    label: parsed.value.label,
    remark: parsed.value.remark,
    isPassing: parsed.value.isPassing,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, band: result.band });
}
