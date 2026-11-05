import type { NextResponse } from "next/server";

import { deleteExamTimetableSlot } from "@/lib/server/academics-exams";
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

  const record = body as Record<string, unknown> | null;
  const slotId = typeof record?.slotId === "string" ? record.slotId.trim() : null;
  if (slotId === null || slotId.length === 0) {
    return json({ ok: false, error: "Invalid slot ID." }, 400);
  }

  const result = await deleteExamTimetableSlot({
    supabase,
    schoolId: access.schoolId,
    slotId,
  });

  if (!result.ok) {
    return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
  }

  return json({ ok: true });
}
