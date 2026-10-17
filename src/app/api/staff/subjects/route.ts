import type { NextResponse } from "next/server";

import { parseSubjectCreateInput } from "@/lib/administration/requests";
import { createSubject, listSubjects } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A school's subjects (D-029).
 *
 * `GET` lists subjects behind `subject.read`; `POST` creates one behind
 * `subject.manage`. Subjects are retired by deactivation; the app never deletes
 * one (docs/AGENTS.md 6).
 */

const REASON_STATUS: Record<
  "not_found" | "duplicate" | "invalid" | "other",
  number
> = {
  not_found: 404,
  duplicate: 409,
  invalid: 400,
  other: 500,
};

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "subject.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const subjects = await listSubjects(supabase, access.schoolId);
  if (subjects === null) {
    return json({ ok: false, error: "The subjects could not be loaded." }, 500);
  }

  return json({ ok: true, subjects });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "subject.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseSubjectCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createSubject({
    supabase,
    schoolId: access.schoolId,
    name: parsed.value.name,
    code: parsed.value.code,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, subject: result.subject }, 201);
}
