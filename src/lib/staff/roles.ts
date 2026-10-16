/**
 * Staff role labels shared by the server and the staff-facing UI.
 *
 * Roles are labels; authority comes from the permission catalogue
 * (`public.role_permissions`), never from the name (docs/DECISIONS.md D-021).
 * These helpers only present a role to a person, so the same two approved
 * school-scoped roles are described identically everywhere.
 */

import { STAFF_ROLES, type StaffRole } from "@/lib/staff/requests";

export interface StaffRoleOption {
  readonly value: StaffRole;
  readonly label: string;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  school_administrator: "School administrator",
  teacher: "Teacher",
};

/** The roles an administrator may assign when inviting (D-021), with labels. */
export const STAFF_ROLE_OPTIONS: readonly StaffRoleOption[] = STAFF_ROLES.map(
  (value) => ({ value, label: ROLE_LABELS[value] }),
);

/** Human-readable label for a role; falls back to the raw value if unknown. */
export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}
