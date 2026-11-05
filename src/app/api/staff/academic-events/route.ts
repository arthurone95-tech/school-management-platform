import type { NextResponse } from "next/server";

import { parseAcademicEventCreateInput } from "@/lib/administration/requests";
import {
  createAcademicEvent,
  listAcademicEvents,
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

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "academic.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const url = new URL(request.url);
  const termId = url.searchParams.get("termId");

  const events = await listAcademicEvents(supabase, access.schoolId, termId);
  if (events === null) {
    return json({ ok: false, error: "The academic events could not be loaded." }, 500);
  }

  return json({ ok: true, events });
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

  const parsed = parseAcademicEventCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createAcademicEvent({
    supabase,
    schoolId: access.schoolId,
    termId: parsed.value.termId,
    title: parsed.value.title,
    description: parsed.value.description,
    eventType: parsed.value.eventType,
    startsOn: parsed.value.startsOn,
    endsOn: parsed.value.endsOn,
  });

  if (!result.ok) {
    return json(
      { ok: false, error: result.message },
      REASON_STATUS[result.reason],
    );
  }

  return json({ ok: true, event: result.event }, 201);
}
