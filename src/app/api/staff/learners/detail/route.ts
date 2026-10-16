import type { NextResponse } from "next/server";

import { parseLearnerIdInput } from "@/lib/enrolment/requests";
import { getLearnerDetail } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Reads one student's full record for the correction form (`learner.read`,
 * D-028).
 *
 * `POST` is used rather than a URL parameter so the internal student id never
 * appears in a request line, and therefore never in a server or proxy access
 * log (docs/AGENTS.md 7, docs/SECURITY_AND_PRIVACY.md 11) — the same reasoning
 * that put the staff invitation credential in a fragment (D-025).
 *
 * The read runs on the caller's session client and is scoped to the caller's
 * own school, so another school's student is a `404` — indistinguishable from
 * one that does not exist.
 */

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "learner.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseLearnerIdInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const learner = await getLearnerDetail(
    supabase,
    access.schoolId,
    parsed.value.learnerId,
  );
  if (!learner) {
    return json(
      { ok: false, error: "That student does not exist in your school." },
      404,
    );
  }

  return json({ ok: true, learner });
}
