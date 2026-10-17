import type { NextResponse } from "next/server";

import { parseAcademicYearUpdateInput } from "@/lib/administration/requests";
import { updateAcademicYear } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Updates an academic year (D-029) behind `academic.manage`: rename, change the
 * dates, or mark it current. Setting `isCurrent` true clears any other current
 * year for the school first, so the one-current-year index (migration 0005) is
 * never violated. The write runs on the caller's session client, so a year from
 * another school is indistinguishable from one that does not exist (404).
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

  const parsed = parseAcademicYearUpdateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateAcademicYear({
    supabase,
    schoolId: access.schoolId,
    academicYearId: parsed.value.academicYearId,
    ...(parsed.value.name !== undefined ? { name: parsed.value.name } : {}),
    ...(parsed.value.startsOn !== undefined
      ? { startsOn: parsed.value.startsOn }
      : {}),
    ...(parsed.value.endsOn !== undefined
      ? { endsOn: parsed.value.endsOn }
      : {}),
    ...(parsed.value.isCurrent !== undefined
      ? { isCurrent: parsed.value.isCurrent }
      : {}),
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, academicYear: result.academicYear });
}
