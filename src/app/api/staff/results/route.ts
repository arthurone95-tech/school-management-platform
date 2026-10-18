import type { NextResponse } from "next/server";

import { parseResultSubmitInput } from "@/lib/academics/requests";
import { getResultSheet, submitResultSheet } from "@/lib/server/academics";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A class result sheet (D-031).
 *
 * `GET` reads the sheet behind `assessment.read`: the class roster with each
 * learner's mark, percentage and the grade the school's own bands give it.
 * `POST` writes the whole sheet behind `result.record`, which a teacher holds.
 *
 * The roster comes from the gated `class_roster` function, so marking needs no
 * `learner.read` and exposes no learner field beyond id, registration number and
 * name — the same least-privilege shape as attendance (migration 0006).
 *
 * There is no delete: a mark is corrected by writing it again, and every change
 * is audited.
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

  const assessmentId = new URL(request.url).searchParams.get("assessmentId");
  if (assessmentId === null || assessmentId.trim().length === 0) {
    return json({ ok: false, error: "Choose an assessment." }, 400);
  }

  // Editing is offered only to someone who may record, checked separately so the
  // sheet is readable by anyone permitted to read it.
  const mayRecord = await hasPermission(
    supabase,
    access.schoolId,
    "result.record",
  );

  const result = await getResultSheet({
    supabase,
    schoolId: access.schoolId,
    assessmentId: assessmentId.trim(),
    mayRecord,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, sheet: result.sheet });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "result.record");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseResultSubmitInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await submitResultSheet({
    supabase,
    schoolId: access.schoolId,
    assessmentId: parsed.value.assessmentId,
    entries: parsed.value.entries,
    mayRecord: true,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason] ?? 500,
    );
  }

  return json({ ok: true, sheet: result.sheet });
}

/** Whether the caller holds `permission` in their own school. Fails closed. */
async function hasPermission(
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
