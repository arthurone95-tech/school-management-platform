import type { NextResponse } from "next/server";

import { parseAssessmentCreateInput } from "@/lib/academics/requests";
import { createAssessment, listAssessments } from "@/lib/server/academics";
import { utcToday } from "@/lib/dates";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A class's assessments (D-031).
 *
 * `GET` lists them behind `assessment.read`; `POST` creates one behind
 * `assessment.manage`. Both run on the caller's session client, and the
 * `assessments_*` policies are gated on `can_access_class`, so a teacher sees and
 * creates assessments only for the classes they are assigned to — the same
 * boundary attendance uses (migration 0006).
 *
 * `?includeInactive=true` also returns retired assessments. The default stays
 * active-only so an ordinary list is not cluttered with work a school has
 * finished with.
 */

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  other: 500,
};

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "assessment.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const params = new URL(request.url).searchParams;
  const rawClass = params.get("classId");
  if (rawClass !== null && rawClass.trim().length === 0) {
    return json({ ok: false, error: "Choose a valid class." }, 400);
  }

  const assessments = await listAssessments({
    supabase,
    schoolId: access.schoolId,
    classId: rawClass === null ? null : rawClass.trim(),
    includeInactive: params.get("includeInactive") === "true",
  });

  if (assessments === null) {
    return json(
      { ok: false, error: "The assessments could not be loaded." },
      500,
    );
  }

  return json({ ok: true, assessments });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "assessment.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseAssessmentCreateInput(body, utcToday());
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createAssessment({
    supabase,
    schoolId: access.schoolId,
    classId: parsed.value.classId,
    subjectId: parsed.value.subjectId,
    termId: parsed.value.termId,
    name: parsed.value.name,
    maxScore: parsed.value.maxScore,
    assessedOn: parsed.value.assessedOn,
    notes: parsed.value.notes,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, assessment: result.assessment }, 201);
}
