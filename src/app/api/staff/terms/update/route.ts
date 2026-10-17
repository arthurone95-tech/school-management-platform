import type { NextResponse } from "next/server";

import { parseTermUpdateInput } from "@/lib/administration/requests";
import { updateTerm } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Renames a term or changes its dates (D-029) behind `academic.manage`.
 *
 * The update is scoped to the caller's school in the query as well as by Row
 * Level Security, so another school's term is indistinguishable from a missing
 * one.
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

  const parsed = parseTermUpdateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateTerm({
    supabase,
    schoolId: access.schoolId,
    termId: parsed.value.termId,
    ...(parsed.value.name !== undefined ? { name: parsed.value.name } : {}),
    ...(parsed.value.startsOn !== undefined
      ? { startsOn: parsed.value.startsOn }
      : {}),
    ...(parsed.value.endsOn !== undefined
      ? { endsOn: parsed.value.endsOn }
      : {}),
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, term: result.term });
}
