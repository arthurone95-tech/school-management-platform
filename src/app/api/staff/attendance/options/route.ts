import type { NextResponse } from "next/server";

import {
  listAttendanceClasses,
  listClassSubjects,
} from "@/lib/server/attendance";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The pickers for taking attendance (D-030).
 *
 * `GET` returns the classes the caller may take attendance for and, when a
 * `classId` is given, the subjects they may use in that class.
 *
 * This is deliberately *not* the same as `GET /api/staff/classes`: a teacher
 * holds no `class.read` or `subject.read` (those stay administrator-only), so
 * this endpoint reads through the `accessible_classes` and `class_subjects`
 * functions (migration 0007). Those are `SECURITY DEFINER` and gated on
 * `can_access_class`, so a teacher sees the classes they are assigned to and
 * nothing else — RLS on `classes` and `subjects` is not bypassed for anybody,
 * because the functions apply the same scope test.
 */

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "attendance.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const classes = await listAttendanceClasses(supabase, access.schoolId);
  if (classes === null) {
    return json({ ok: false, error: "The classes could not be loaded." }, 500);
  }

  const classId = new URL(request.url).searchParams.get("classId");
  if (classId === null || classId.trim().length === 0) {
    return json({ ok: true, classes, subjects: [] });
  }

  const subjects = await listClassSubjects(
    supabase,
    access.schoolId,
    classId.trim(),
  );
  if (subjects === null) {
    return json({ ok: false, error: "The subjects could not be loaded." }, 500);
  }

  return json({ ok: true, classes, subjects });
}
