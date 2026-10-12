import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

/**
 * Local test harness for database migrations.
 *
 * PGlite is a WASM build of PostgreSQL. It lets the migration and its Row Level
 * Security policies be exercised without a Supabase project, which is a
 * hardening requirement, not a substitute for it: PGlite is not Supabase, so
 * Auth Hook behaviour, the GoTrue schema and plan-specific settings still have
 * to be verified against a real non-production project.
 *
 * The stub below recreates the small part of the Supabase environment that the
 * migration depends on: the `anon`, `authenticated` and `service_role` roles,
 * the `auth.users` table, and `auth.uid()` reading the request JWT subject.
 */

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  -- Supabase's GoTrue runs the Auth Hook as this role (migration 0002 grants
  -- execution to it).
  create role supabase_auth_admin nologin;

  create schema auth;
  create table auth.users (id uuid primary key);

  create or replace function auth.uid() returns uuid
    language sql stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
`;

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../supabase/migrations/", import.meta.url),
);

/**
 * Creates a fresh in-memory database with the Supabase stub and every approved
 * migration applied in filename order (the same order Supabase applies them).
 * Runs as the superuser; use {@link actAs} to switch to a client role before
 * asserting policy behaviour.
 */
export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
  }
  return db;
}

/** Returns to the superuser session, which bypasses RLS (used for fixtures). */
export async function actAsSystem(db: PGlite): Promise<void> {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '', false);`,
  );
}

/** Acts as an authenticated user with the given internal `auth.users` id. */
export async function actAsUser(db: PGlite, userId: string): Promise<void> {
  await db.exec(`set role authenticated;`);
  await db.exec(
    `select set_config('request.jwt.claim.sub', '${userId}', false);`,
  );
}

/** Acts as an unauthenticated request (role `anon`). */
export async function actAsAnonymous(db: PGlite): Promise<void> {
  await db.exec(`set role anon;`);
  await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
}

/** Acts as the server-only secret key (`service_role`, bypasses RLS). */
export async function actAsServiceRole(db: PGlite): Promise<void> {
  await db.exec(`set role service_role;`);
  await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
}
