import "server-only";

import type {
  StaffAssignmentSummary,
  StaffMemberSummary,
} from "@/lib/administration/types";
import type { MemberStatusAction } from "@/lib/administration/requests";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Staff membership administration (D-029): listing a school's members with
 * their assignments, and suspending / restoring / revoking a membership.
 *
 * The membership rows and assignments are read on the caller's session client,
 * so Row Level Security scopes them to the caller's school. The member *email*
 * lives in Supabase Auth (`auth.users`), which PostgREST does not expose; the
 * server-only secret key resolves it, exactly as the invitation flow does. The
 * lookup is bounded to the memberships already read for the caller's school, so
 * the privileged client cannot be used to enumerate other schools (docs/AGENTS.md
 * 4, 11).
 *
 * Status changes run on the session client behind `member.manage`; the database
 * trigger records an audit event, and `has_school_permission` ignores a
 * non-active membership, so a suspended or revoked member loses access at once.
 */

const NEXT_STATUS: Record<
  MemberStatusAction,
  "active" | "suspended" | "revoked"
> = {
  suspend: "suspended",
  restore: "active",
  revoke: "revoked",
};

/** Lists a school's staff members with their class/subject assignments. */
export async function listSchoolMembers(input: {
  readonly supabase: ServerClient;
  readonly admin: AdminClient;
  readonly schoolId: string;
}): Promise<StaffMemberSummary[] | null> {
  const { supabase, admin, schoolId } = input;

  const { data: members, error: membersError } = await supabase
    .from("school_members")
    .select("id, user_id, role, status")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: true });

  if (membersError || !members) {
    return null;
  }

  const [assignmentsResult, classesResult, subjectsResult] = await Promise.all([
    supabase
      .from("staff_assignments")
      .select("id, membership_id, class_id, subject_id")
      .eq("school_id", schoolId),
    supabase.from("classes").select("id, name").eq("school_id", schoolId),
    supabase.from("subjects").select("id, name").eq("school_id", schoolId),
  ]);

  const classNames = new Map(
    (classesResult.data ?? []).map((row) => [
      row.id as string,
      row.name as string,
    ]),
  );
  const subjectNames = new Map(
    (subjectsResult.data ?? []).map((row) => [
      row.id as string,
      row.name as string,
    ]),
  );

  const byMembership = new Map<string, StaffAssignmentSummary[]>();
  for (const row of assignmentsResult.data ?? []) {
    const membershipId = row.membership_id as string;
    const classId = row.class_id as string | null;
    const subjectId = row.subject_id as string | null;
    const list = byMembership.get(membershipId) ?? [];
    list.push({
      id: row.id as string,
      classId,
      className: classId ? (classNames.get(classId) ?? null) : null,
      subjectId,
      subjectName: subjectId ? (subjectNames.get(subjectId) ?? null) : null,
    });
    byMembership.set(membershipId, list);
  }

  const results: StaffMemberSummary[] = [];
  for (const row of members) {
    const userId = row.user_id as string;
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(userId);
    results.push({
      membershipId: row.id as string,
      userId,
      email: userError ? null : (userData.user?.email ?? null),
      role: row.role as string,
      status: row.status as string,
      assignments: byMembership.get(row.id as string) ?? [],
    });
  }

  return results;
}

export type MemberStatusResult =
  | { readonly ok: true; readonly status: "active" | "suspended" | "revoked" }
  | { readonly ok: false; readonly message: string };

/** Applies a suspend / restore / revoke to one membership in the caller's school. */
export async function setMemberStatus(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly membershipId: string;
  readonly action: MemberStatusAction;
}): Promise<MemberStatusResult> {
  const next = NEXT_STATUS[input.action];

  // Mirroring the learner pattern (D-023): setting the status already in force
  // is a no-op, so a repeated request never appends an empty audit event.
  const { data: current, error: readError } = await input.supabase
    .from("school_members")
    .select("id, status")
    .eq("id", input.membershipId)
    .eq("school_id", input.schoolId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: "The staff member could not be updated." };
  }
  if (!current) {
    return { ok: false, message: "That staff member could not be found." };
  }
  if (current.status === next) {
    return { ok: true, status: next };
  }

  const { data, error } = await input.supabase
    .from("school_members")
    .update({ status: next })
    .eq("id", input.membershipId)
    .eq("school_id", input.schoolId)
    .select("id, status")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "The staff member could not be updated." };
  }
  return { ok: true, status: next };
}
