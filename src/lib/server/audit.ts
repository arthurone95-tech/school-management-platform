import "server-only";

import {
  AUDIT_PAGE_SIZE,
  type AuditEventPage,
  type AuditEventSummary,
} from "@/lib/audit/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Read-only school activity view (D-023).
 *
 * The rows are read on the caller's session client, so the `audit.read` RLS
 * select policy and the explicit school filter are both enforced before a row
 * reaches this module. The server-only client resolves actor ids to emails only
 * for the bounded page already read, and an unresolved actor stays anonymous in
 * the UI. No personal values are selected: the trigger stores changed column
 * names only.
 */
export async function listAuditEvents(input: {
  readonly supabase: ServerClient;
  readonly admin: AdminClient;
  readonly schoolId: string;
  readonly page: number;
}): Promise<AuditEventPage | null> {
  const { supabase, admin, schoolId, page } = input;
  const from = (page - 1) * AUDIT_PAGE_SIZE;
  const to = from + AUDIT_PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("audit_events")
    .select(
      "id, actor_user_id, action, target_table, target_id, details, created_at",
      { count: "exact" },
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error || !data) {
    return null;
  }

  const actorIds = Array.from(
    new Set(
      data
        .map((row) => row.actor_user_id as string | null)
        .filter((id): id is string => id !== null),
    ),
  );
  const actorEmails = new Map<string, string | null>();
  await Promise.all(
    actorIds.map(async (id) => {
      const { data: userData, error: userError } =
        await admin.auth.admin.getUserById(id);
      actorEmails.set(id, userError ? null : (userData.user?.email ?? null));
    }),
  );

  const events: AuditEventSummary[] = data.map((row) => {
    const details = row.details as { changed_columns?: unknown } | null;
    const columns = details?.changed_columns;
    const changedColumns = Array.isArray(columns)
      ? columns
          .filter((value): value is string => typeof value === "string")
          .slice(0, 20)
      : [];

    return {
      id: String(row.id),
      action: row.action as string,
      targetTable: row.target_table as string,
      targetId: row.target_id as string,
      actorEmail: actorEmails.get(row.actor_user_id as string) ?? null,
      changedColumns,
      createdAt: row.created_at as string,
    };
  });

  return {
    events,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    total: count ?? events.length,
  };
}
