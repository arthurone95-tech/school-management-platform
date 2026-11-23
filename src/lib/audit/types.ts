/**
 * Shared shapes for the read-only school activity view.
 *
 * The audit table is append-only and its RLS select policy already requires the
 * `audit.read` permission. These shapes carry only the safe fields stored by
 * the audit trigger: action, table, target id, changed column names and actor.
 * No personal values are stored in, or returned from, the audit trail.
 */

export interface AuditEventSummary {
  readonly id: string;
  readonly action: string;
  readonly targetTable: string;
  readonly targetId: string;
  readonly actorEmail: string | null;
  readonly changedColumns: readonly string[];
  readonly createdAt: string;
}

export interface AuditEventPage {
  readonly events: readonly AuditEventSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export const AUDIT_PAGE_SIZE = 25;
