import type { NextResponse } from "next/server";

import { parseGradeBandCreateInput } from "@/lib/academics/requests";
import { createGradeBand, listGradeBands } from "@/lib/server/academics";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A school's grading bands (D-031).
 *
 * `GET` lists them behind `grade.read`, which the teacher also holds: marking
 * against a scale you cannot see is not workable. `POST` adds one behind
 * `grade.manage`, which stays administrator-only.
 *
 * These bands are the school's own configuration because `docs/PRD.md` 11 records
 * grading as unvalidated and differing between schools. The platform therefore
 * stores a scale and never assumes one.
 */

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  other: 500,
};

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "grade.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const bands = await listGradeBands(supabase, access.schoolId);
  if (bands === null) {
    return json(
      { ok: false, error: "The grade bands could not be loaded." },
      500,
    );
  }

  return json({ ok: true, bands });
}

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

  const parsed = parseGradeBandCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createGradeBand({
    supabase,
    schoolId: access.schoolId,
    minPercentage: parsed.value.minPercentage,
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

  return json({ ok: true, band: result.band }, 201);
}
