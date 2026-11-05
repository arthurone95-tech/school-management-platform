import type { NextResponse } from "next/server";

import { parseAcademicEventCreateInput } from "@/lib/administration/requests";
import {
  deleteAcademicEvent,
  updateAcademicEvent,
} from "@/lib/server/academics-events";
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
  const eventId = typeof record?.eventId === "string" ? record.eventId.trim() : null;
  if (eventId === null || eventId.length === 0) {
    return json({ ok: false, error: "Invalid event ID." }, 400);
  }

  const action = typeof record?.action === "string" ? record.action : "update";

  if (action === "delete") {
    const result = await deleteAcademicEvent({
      supabase,
      schoolId: access.schoolId,
      eventId,
    });
    if (!result.ok) {
      return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
    }
    return json({ ok: true });
  }

  const parsed = parseAcademicEventCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await updateAcademicEvent({
    supabase,
    schoolId: access.schoolId,
    eventId,
    termId: parsed.value.termId,
    title: parsed.value.title,
    description: parsed.value.description,
    eventType: parsed.value.eventType,
    startsOn: parsed.value.startsOn,
    endsOn: parsed.value.endsOn,
  });

  if (!result.ok) {
    return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
  }

  return json({ ok: true, event: result.event });
}
