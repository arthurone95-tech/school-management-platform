import type { NextResponse } from "next/server";

import { parseTermCreateInput } from "@/lib/administration/requests";
import { createTerm } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Creates a term inside an academic year (D-029) behind `academic.manage`.
 *
 * The composite foreign key on `public.terms` keeps the term and its year in one
 * school, so naming another school's year fails the constraint rather than
 * crossing the tenant boundary (docs/AGENTS.md 4).
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

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "academic.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseTermCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createTerm({
    supabase,
    schoolId: access.schoolId,
    academicYearId: parsed.value.academicYearId,
    name: parsed.value.name,
    startsOn: parsed.value.startsOn,
    endsOn: parsed.value.endsOn,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, term: result.term }, 201);
}
