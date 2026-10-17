import type { NextResponse } from "next/server";

import { parseAcademicYearCreateInput } from "@/lib/administration/requests";
import {
  createAcademicYear,
  listAcademicYears,
} from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A school's academic years and their terms (D-029).
 *
 * `GET` lists the years (each with its terms) behind `academic.read`; `POST`
 * creates a year behind `academic.manage`. The school is resolved from the
 * caller's own active membership — never from the request — and the reads and
 * writes run on the caller's session client, so Row Level Security scopes them
 * to that school.
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

  const access = await resolveSchoolAccess(supabase, "academic.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const academicYears = await listAcademicYears(supabase, access.schoolId);
  if (academicYears === null) {
    return json(
      { ok: false, error: "The academic years could not be loaded." },
      500,
    );
  }

  return json({ ok: true, academicYears });
}

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

  const parsed = parseAcademicYearCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createAcademicYear({
    supabase,
    schoolId: access.schoolId,
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

  return json({ ok: true, academicYear: result.academicYear }, 201);
}
