import type { NextResponse } from "next/server";

import { parseExamTimetableSlotCreateInput } from "@/lib/administration/requests";
import {
  createExamTimetableSlot,
  listExamTimetableSlots,
} from "@/lib/server/academics-exams";
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
  const scheduleId = url.searchParams.get("scheduleId");
  if (scheduleId === null || scheduleId.trim().length === 0) {
    return json({ ok: false, error: "Choose an exam schedule." }, 400);
  }

  const slots = await listExamTimetableSlots(supabase, access.schoolId, scheduleId.trim());
  if (slots === null) {
    return json({ ok: false, error: "The timetable slots could not be loaded." }, 500);
  }

  return json({ ok: true, slots });
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

  const parsed = parseExamTimetableSlotCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createExamTimetableSlot({
    supabase,
    schoolId: access.schoolId,
    examScheduleId: parsed.value.examScheduleId,
    subjectId: parsed.value.subjectId,
    classId: parsed.value.classId,
    examDate: parsed.value.examDate,
    startTime: parsed.value.startTime,
    endTime: parsed.value.endTime,
    roomName: parsed.value.roomName,
    supervisorId: parsed.value.supervisorId,
  });

  if (!result.ok) {
    return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
  }

  return json({ ok: true, slot: result.slot }, 201);
}
