import type { NextResponse } from "next/server";

import { importLearners } from "@/lib/server/dataexchange";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Bulk import of a learner's existing class list (D-032), behind
 * `learner.import` (administrator only).
 *
 * Each row is validated by the same parser the single-student enrolment form
 * runs, and written by the same `enrolLearner` operation on the caller's session
 * client. There is deliberately no second write path: a bulk row is held to
 * exactly the same rules as a typed one, and the existing database constraints
 * apply unchanged.
 *
 * The response reports **every row**, created or not, with its file line number,
 * so a head teacher can fix the specific lines that failed and re-import just
 * those. Each created learner is audited by the existing `learners` trigger, and
 * each placement by its own.
 */

/** Refuses a request body large enough to be an unbounded batch. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "learner.import");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) {
    return json(
      {
        ok: false,
        error: "That file is too large. Split it and import in parts.",
      },
      413,
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json(
        {
          ok: false,
          error: "That file is too large. Split it and import in parts.",
        },
        413,
      );
    }
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const csv = (body as { csv?: unknown } | null)?.csv;
  if (typeof csv !== "string" || csv.trim().length === 0) {
    return json({ ok: false, error: "Choose a CSV file to import." }, 400);
  }

  const outcome = await importLearners({
    supabase,
    schoolId: access.schoolId,
    userId: access.userId,
    csv,
  });

  if (!outcome.ok) {
    return json({ ok: false, error: outcome.message }, 400);
  }

  return json({ ok: true, ...outcome.result });
}
