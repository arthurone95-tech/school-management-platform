import type { NextResponse } from "next/server";

import { createAssessmentComponent, listAssessmentComponents } from "@/lib/server/administration";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Assessment components & weightings (D-029). */
const REASON_STATUS: Record<
  "not_found" | "duplicate" | "invalid" | "other",
  number
> = {
  not_found: 404,
  duplicate: 495,
  invalid: 400,
  other: 500,
};

/** List assessment components for the school. */
export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "academic.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const components = await listAssessmentComponents(supabase, access.schoolId);
  if (components === null) {
    return json({ ok: false, error: "The assessment components could not be loaded." }, 500);
  }

  return json({ ok: true, components });
};

/** Create a new assessment component. */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "academic.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const body = (await request.json()) as {
    name: string;
    defaultWeight: number;
    description?: string;
  };
  // Validate required fields
  if (!body.name || typeof body.defaultWeight !== "number") {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const result = await createAssessmentComponent({
    supabase,
    schoolId: access.schoolId,
    name: body.name,
    defaultWeight: body.defaultWeight,
    description: body.description,
  });

  if (!result.ok) {
    return json({ ok: false, error: result.message }, REASON_STATUS[result.reason]);
  }

  return json({ ok: true, component: result.component }, 201);
};