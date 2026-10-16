import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Shared server-side authorization for the staff API routes.
 *
 * Every staff route must answer the same four questions before it touches a
 * school's data: is there a verified session, which single school does the
 * caller belong to, is the membership active, and does the caller hold the
 * permission the operation needs. Repeating that sequence in each route invites
 * a subtle divergence, so it lives here once (docs/AGENTS.md 5, 11).
 *
 * This is an *additional* boundary, not the only one: Row Level Security on the
 * tables remains the enforcement point that does not depend on application
 * code. A caller cannot talk to PostgREST directly and skip this helper.
 */

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type SchoolAccess =
  | { readonly ok: true; readonly userId: string; readonly schoolId: string }
  | {
      readonly ok: false;
      readonly status: 401 | 403 | 500;
      readonly message: string;
    };

/**
 * Resolves the caller's verified user id and single active school, then checks
 * `permission` against that school. Returns a typed failure instead of throwing
 * so a route can map it straight onto a response.
 */
export async function resolveSchoolAccess(
  supabase: ServerClient,
  permission: string,
): Promise<SchoolAccess> {
  // Verify the session with the auth server — never trust a cookie alone.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, status: 401, message: "Not signed in." };
  }

  // The caller's own active membership decides the school. RLS only surfaces
  // memberships of schools where the caller is an active member.
  const { data: mine, error: mineError } = await supabase
    .from("school_members")
    .select("school_id, role")
    .eq("user_id", userData.user.id)
    .eq("status", "active");

  if (mineError) {
    return {
      ok: false,
      status: 500,
      message: "Membership could not be resolved.",
    };
  }

  if (!mine || mine.length === 0) {
    return {
      ok: false,
      status: 403,
      message: "You are not an active member of a school.",
    };
  }
  if (mine.length > 1) {
    // D-017 excludes multi-school membership in the first release; fail closed.
    return {
      ok: false,
      status: 500,
      message: "Account membership is misconfigured.",
    };
  }

  const schoolId = mine[0]?.school_id as string | undefined;
  if (!schoolId) {
    return {
      ok: false,
      status: 500,
      message: "Account membership is misconfigured.",
    };
  }

  const { data: allowed, error: permissionError } = await supabase.rpc(
    "has_school_permission",
    { target_school_id: schoolId, required_permission: permission },
  );

  if (permissionError || allowed !== true) {
    return { ok: false, status: 403, message: "Not permitted." };
  }

  return { ok: true, userId: userData.user.id, schoolId };
}
