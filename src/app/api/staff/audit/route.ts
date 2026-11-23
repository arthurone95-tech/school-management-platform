import type { NextResponse } from "next/server";

import { parsePageParam } from "@/lib/enrolment/requests";
import { listAuditEvents } from "@/lib/server/audit";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A bounded, read-only page of the school's audit trail behind the existing
 * `audit.read` permission. The school comes from the caller's active membership,
 * not from the request; RLS is the database-level boundary. Actor emails are
 * resolved server-side only for the rows already returned by that query.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "audit.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const page = parsePageParam(new URL(request.url).searchParams.get("page"));
  const admin = createSupabaseAdminClient();
  const result = await listAuditEvents({
    supabase,
    admin,
    schoolId: access.schoolId,
    page,
  });

  if (!result) {
    return json(
      { ok: false, error: "The activity log could not be loaded." },
      500,
    );
  }

  return json({ ok: true, ...result });
}
