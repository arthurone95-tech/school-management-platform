import type { NextResponse } from "next/server";

import { parseStatusTransitionInput } from "@/lib/administration/requests";
import { updateAcademicYear, updateTerm } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const parsed = parseStatusTransitionInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const { id, status, entityType } = parsed.value;

  if (entityType === "year") {
    const result = await updateAcademicYear({
      supabase,
      schoolId: access.schoolId,
      academicYearId: id,
      status,
    });
    if (!result.ok) {
      return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
    }
    return json({ ok: true, academicYear: result.academicYear });
  }

  const result = await updateTerm({
    supabase,
    schoolId: access.schoolId,
    termId: id,
    status,
  });
  if (!result.ok) {
    return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
  }

  return json({ ok: true, term: result.term });
}
