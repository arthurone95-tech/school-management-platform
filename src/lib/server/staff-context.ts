import "server-only";

import { isStaffRole } from "@/lib/staff/requests";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * The signed-in staff member's identity and school, for the session-gated
 * halves of the dashboard pages.
 *
 * Returns `null` for every case that must be treated as "not a school staff
 * member": no verified session, no active membership, and (per D-017) anything
 * other than exactly one active staff membership. Callers redirect to sign-in.
 *
 * This is a user-experience gate only: the APIs repeat the same checks
 * server-side and Row Level Security is the actual boundary.
 */
export interface StaffContext {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly schoolId: string;
  readonly schoolName: string | null;
  /** Checks a permission against the resolved school. */
  hasPermission(permission: string): Promise<boolean>;
}

export async function loadStaffContext(
  supabase: ServerClient,
): Promise<StaffContext | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return null;
  }

  // RLS only surfaces memberships of schools where the caller is an active member.
  const { data: memberships, error: membershipError } = await supabase
    .from("school_members")
    .select("school_id, role")
    .eq("user_id", userData.user.id)
    .eq("status", "active");

  if (membershipError) {
    return null;
  }

  const active = memberships ?? [];
  if (active.length !== 1) {
    return null;
  }

  const membership = active[0];
  if (!membership || !isStaffRole(membership.role)) {
    return null;
  }

  const schoolId = membership.school_id as string;

  // RLS lets an active member read their own school's row.
  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle<{ name: string }>();

  return {
    userId: userData.user.id,
    email: userData.user.email ?? "",
    role: membership.role as string,
    schoolId,
    schoolName: school?.name ?? null,
    async hasPermission(permission: string): Promise<boolean> {
      const { data } = await supabase.rpc("has_school_permission", {
        target_school_id: schoolId,
        required_permission: permission,
      });
      return data === true;
    },
  };
}
