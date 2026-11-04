import type { NextResponse } from "next/server";

import {
  parseGesScoreSubmitInput,
  parseGesSheetQuery,
} from "@/lib/academics/ges-requests";
import { getAssessmentMode } from "@/lib/server/assessment-mode";
import {
  getGesOptions,
  getGesSheet,
  submitGesScores,
} from "@/lib/server/ges-results";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { utcToday } from "@/lib/dates";

/**
 * GES 50 + 50 score entry and terminal report data.
 *
 * `GET` returns the caller's accessible classes, term options and (when a class
 * is chosen) the class's GES sheet behind `assessment.read`. `POST` saves one
 * learner's subject scores behind `result.record`, and may create the GES subject
 * assessments on first use, which is why it also requires `assessment.manage`.
 *
 * The endpoint refuses to run unless the school is in `ges_standard` mode, so a
 * custom school cannot accidentally write GES-shaped marks. The reverse is also
 * true: the custom result endpoint rejects GES assessments. Existing records are
 * never converted or deleted when a school changes mode.
 */

const REASON_STATUS: Record<"not_found" | "duplicate" | "invalid" | "other", number> =
  {
    not_found: 404,
    duplicate: 409,
    invalid: 400,
    other: 500,
  };

async function hasPermission(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  permission: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("has_school_permission", {
    target_school_id: schoolId,
    required_permission: permission,
  });
  return data === true;
}

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const access = await resolveSchoolAccess(supabase, "assessment.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const mode = await getAssessmentMode(supabase, access.schoolId);
  if (mode === null) {
    return json(
      { ok: false, error: "The assessment framework could not be read." },
      500,
    );
  }
  if (mode !== "ges_standard") {
    return json(
      {
        ok: false,
        error:
          "This school uses the Fully Custom Framework. Open the custom results view instead.",
      },
      409,
    );
  }

  const query = new URL(request.url).searchParams;
  const parsed = parseGesSheetQuery(query);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const options = await getGesOptions(supabase, access.schoolId);
  if (!options) {
    return json(
      { ok: false, error: "The GES score options could not be loaded." },
      500,
    );
  }

  if (options.terms.length === 0 || parsed.value.classId === null) {
    return json({
      ok: true,
      classes: options.classes,
      terms: options.terms,
      sheet: null,
    });
  }

  const canRecord =
    (await hasPermission(supabase, access.schoolId, "result.record")) &&
    (await hasPermission(supabase, access.schoolId, "assessment.manage"));

  const result = await getGesSheet({
    supabase,
    schoolId: access.schoolId,
    classId: parsed.value.classId,
    termId: parsed.value.termId,
    mayRecord: canRecord,
    today: utcToday(),
    options,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({
    ok: true,
    classes: options.classes,
    terms: options.terms,
    sheet: result.sheet,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const access = await resolveSchoolAccess(supabase, "result.record");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  if (
    !(await hasPermission(supabase, access.schoolId, "assessment.manage"))
  ) {
    return json(
      {
        ok: false,
        error:
          "You need permission to set up GES subject assessments before recording scores.",
      },
      403,
    );
  }

  const mode = await getAssessmentMode(supabase, access.schoolId);
  if (mode === null) {
    return json(
      { ok: false, error: "The assessment framework could not be read." },
      500,
    );
  }
  if (mode !== "ges_standard") {
    return json(
      {
        ok: false,
        error:
          "This school uses the Fully Custom Framework. GES scores cannot be recorded.",
      },
      409,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseGesScoreSubmitInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await submitGesScores({
    supabase,
    schoolId: access.schoolId,
    userId: access.userId,
    mayRecord: true,
    today: utcToday(),
    submit: parsed.value,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, sheet: result.sheet });
}
