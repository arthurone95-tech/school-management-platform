import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadStaffContext } from "@/lib/server/staff-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { DataClient } from "./data-client";

/**
 * Session-gated half of the import/export page (D-032).
 *
 * The three permissions are distinct because the three acts are distinct:
 * importing a learner's record, exporting the whole roll, and exporting a class
 * sheet. A user-experience gate only; the API repeats every check and the export
 * audit row is written by the database.
 */
export async function DataGate() {
  await connection();

  const supabase = await createSupabaseServerClient();
  const context = await loadStaffContext(supabase);
  if (!context) {
    redirect("/sign-in");
  }

  const [canImport, canExportLearners, canExportReports] = await Promise.all([
    context.hasPermission("learner.import"),
    context.hasPermission("learner.export"),
    context.hasPermission("report.export"),
  ]);

  if (!canImport && !canExportLearners && !canExportReports) {
    redirect("/dashboard");
  }

  return (
    <DataClient
      email={context.email}
      role={context.role}
      schoolName={context.schoolName}
      canImport={canImport}
      canExportLearners={canExportLearners}
      canExportReports={canExportReports}
    />
  );
}
