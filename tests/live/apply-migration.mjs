// Applies one version-controlled migration to the non-production dev project
// through the Management API and records it in
// supabase_migrations.schema_migrations.
//
// This is the repeatable working path while the Supabase CLI cannot be linked
// (linking requires the project database password, a user-supplied value never
// stored in this repo). The recorded rows — version, statements, name — are
// exactly what the CLI's `db push` reads, so a future CLI adoption skips these
// migrations instead of re-applying them (docs/DATABASE_DOCUMENTATION.md 8,
// supabase/README.md).
//
// Usage:
//   node tests/live/apply-migration.mjs supabase/migrations/<file>.sql
//
// Requires SUPABASE_MGMT_TOKEN and SUPABASE_MGMT_PROJECT_REF in the
// environment (the same values used by steps 06 and 07).
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { mgmtFetch } from "./mgmt.mjs";

function fail(message) {
  console.error(`apply-migration: ${message}`);
  process.exit(1);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    fail("usage: node tests/live/apply-migration.mjs <migration.sql>");
  }

  const sql = readFileSync(filePath, "utf8").trim();
  if (!sql) fail(`empty migration file: ${filePath}`);

  const name = basename(filePath);
  const match = /^(\d+)_(.+)\.sql$/.exec(name);
  if (!match) {
    fail(
      `migration files must be named <UTC timestamp>_<description>.sql: ${name}`,
    );
  }
  const version = match[1];

  // Statements recorded the way the CLI records them: split on ';' boundaries.
  const statements = sql
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // 1. Run the migration. The file carries its own BEGIN/COMMIT.
  await mgmtFetch("/database/query", "POST", { query: sql });

  // 2. Record it so future CLI adoption skips rather than re-applies it.
  //    `name` stores the full migration filename, matching the CLI's format.
  //    Single quotes inside the statements JSON are escaped for the literal.
  const escapedVersion = version.replaceAll("'", "''");
  const escapedName = name.replaceAll("'", "''");
  const escapedStatements = JSON.stringify(statements).replaceAll("'", "''");
  await mgmtFetch("/database/query", "POST", {
    query: `insert into supabase_migrations.schema_migrations (version, statements, name)
            values ('${escapedVersion}', (select array_agg(t) from jsonb_array_elements_text('${escapedStatements}'::jsonb) as e(t)), '${escapedName}')`,
  });

  // 3. Confirm the recorded row.
  const rows = await mgmtFetch(`/database/query`, "POST", {
    query: `select version, name from supabase_migrations.schema_migrations where version = '${escapedVersion}'`,
  });

  const recorded = Array.isArray(rows) ? rows[0] : null;
  if (!recorded) fail(`migration ran but was not recorded: ${version}`);
  console.log(
    `applied ${version} (${recorded.name}) — recorded in schema_migrations`,
  );
}

main().catch((error) => {
  fail(error.message ?? String(error));
});
