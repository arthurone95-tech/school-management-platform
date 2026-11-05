import type { NextResponse } from "next/server";

import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { updateExamSchedule, deleteExamSchedule } from "@/lib/server/academics-exams";
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
  const scheduleId = typeof record?.scheduleId === "string" ? record.scheduleId.trim() : null;
  if (scheduleId === null || scheduleId.length === 0) {
    return json({ ok: false, error: "Invalid schedule ID." }, 400);
  }

  const action = typeof record?.action === "string" ? record.action : "update";

  if (action === "delete") {
    const result = await deleteExamSchedule({ supabase, schoolId: access.schoolId, scheduleId });
    if (!result.ok) {
      return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
    }
    return json({ ok: true });
  }

  const name = typeof record?.name === "string" ? record.name.trim() : undefined;
  const startsOn = typeof record?.startsOn === "string" ? record.startsOn : undefined;
  const endsOn = typeof record?.endsOn === "string" ? record.endsOn : undefined;
  const status = typeof record?.status === "string" ? record.status : undefined;

  const result = await updateExamSchedule({
    supabase,
    schoolId: access.schoolId,
    scheduleId,
    ...(name !== undefined ? { name } : {}),
    ...(startsOn !== undefined ? { startsOn } : {}),
    ...(endsOn !== undefined ? { endsOn } : {}),
    ...(status !== undefined ? { status } : {}),
  });

  if (!result.ok) {
    return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
  }

  return json({ ok: true, schedule: result.schedule });
}
