import type { NextResponse } from "next/server";

import { parseClassCreateInput } from "@/lib/enrolment/requests";
import { createClass, listClasses } from "@/lib/server/enrolment";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A school's classes (D-018, D-028).
 *
 * `GET` lists the caller's school classes — active only by default (the
 * enrolment selector), or every class with `?includeInactive=true` for the
 * class administration page — behind `class.read`. `POST` creates a class
 * behind `class.manage`.
 *
 * The school is resolved from the caller's own active membership — never from
 * the request — and the reads and writes run on the caller's session client, so
 * Row Level Security scopes them to that school regardless of this handler.
 */

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "class.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const includeInactive =
    new URL(request.url).searchParams.get("includeInactive") === "true";

  const classes = await listClasses(supabase, access.schoolId, {
    includeInactive,
  });
  if (classes === null) {
    return json({ ok: false, error: "The classes could not be loaded." }, 500);
  }

  return json({ ok: true, classes });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "class.manage");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseClassCreateInput(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.message }, 400);
  }

  const result = await createClass({
    supabase,
    schoolId: access.schoolId,
    name: parsed.value.name,
  });

  if (!result.ok) {
    const status = result.reason === "duplicate" ? 409 : 500;
    return json({ ok: false, error: result.message }, status);
  }

  return json({ ok: true, klass: result.klass }, 201);
}
