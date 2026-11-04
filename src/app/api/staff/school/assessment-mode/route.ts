import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  // Any staff member with result visibility may read the active mode so the
  // settings page can explain which framework is in force. Only an
  // administrator may change it (see POST).
  const access = await resolveSchoolAccess(supabase, "grade.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }
  const { data, error } = await supabase
    .from("schools")
    .select("assessment_mode")
    .eq("id", access.schoolId)
    .maybeSingle<{ assessment_mode: string }>();
  if (error || !data) {
    return json({ ok: false, error: "The assessment mode could not be read." }, 500);
  }
  return json({ ok: true, mode: data.assessment_mode });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const access = await resolveSchoolAccess(supabase, "school.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }
  const mode =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).mode
      : undefined;
  if (mode !== "ges_standard" && mode !== "custom") {
    return json({ ok: false, error: "Invalid assessment mode." }, 400);
  }

  const { error } = await supabase
    .from("schools")
    .update({ assessment_mode: mode })
    .eq("id", access.schoolId);
  if (error) {
    return json({ ok: false, error: "The assessment mode could not be saved." }, 500);
  }
  return json({ ok: true, mode });
}