import type { NextResponse } from "next/server";

import {
  parseEnrolmentInput,
  parseLearnerStatusFilter,
  parsePageParam,
} from "@/lib/enrolment/requests";
import { enrolLearner, listLearners } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Student enrolment (D-018).
 *
 * `GET` lists the caller's school learners with their current class placement —
 * `learner.read`. By default it returns active students only; `?status=inactive`
 * explicitly reaches inactive records, which are kept out of routine views
 * (D-023). `POST` registers a learner and creates the initial placement —
 * `learner.create`. In both cases the school comes from the caller's own active
 * membership, the permission is checked server-side, and Row Level Security on
 * `learners` and `learner_class_placements` is the database-level boundary, so
 * these handlers are not the only thing standing between two schools.
 */

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "learner.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const url = new URL(request.url);
  const page = parsePageParam(url.searchParams.get("page"));
  const status = parseLearnerStatusFilter(url.searchParams.get("status"));

  const result = await listLearners(supabase, access.schoolId, page, status);
  if (result === null) {
    return json({ ok: false, error: "The students could not be loaded." }, 500);
  }

  return json({ ok: true, ...result });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "learner.create");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseEnrolmentInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await enrolLearner({
    supabase,
    schoolId: access.schoolId,
    userId: access.userId,
    input: parsed.value,
  });

  if (!result.ok) {
    const status =
      result.reason === "class_not_found"
        ? 400
        : result.reason === "duplicate"
          ? 409
          : 500;
    return json({ ok: false, error: result.message }, status);
  }

  return json(
    {
      ok: true,
      learner: result.learner,
      completedExisting: result.completedExisting,
    },
    201,
  );
}
