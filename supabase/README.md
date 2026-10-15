# Database migrations

This directory holds the version-controlled database schema for the school
management platform. Migrations here are the source of truth for the schema
(`docs/DATABASE_DOCUMENTATION.md` 8): any non-production or production
environment can be rebuilt from them in order.

## Status

Migrations are **verified locally** (PGlite, `tests/database/`) and **applied
live** to the non-production dev project `school-management-dev`
(`docs/PHASE0_RISK_REGISTER.md` 10.4):

- `20261011000001_enrolment_foundation.sql` — tenants, membership, classes,
  learners, placements, portal credentials, audit, RLS
- `20261011000002_portal_signup_guard.sql` — sign-up guard Auth Hook (D-020)
- `20261012000003_staff_auth_roles.sql` — role labels aligned with D-021
  (`school_administrator`, `teacher`), applied and recorded 2026-10-12

No production database exists; the Free dev project is a **disposable,
non-production** environment (D-013, D-015).

**Email caveats (dev only, verified 2026-10-12).** Supabase's built-in mailer
(Free-plan shared pooler) rejects `@example.com` recipients at send time (no
MX/DNS) and budgets sends at 2 per hour (`rate_limit_email_sent`, not
configurable without paid custom SMTP). The staff-invite live check therefore
sends one synthetic `@gmail.com` invitation per run; real deployments must use
real recipient domains.

## Creating a second environment (non-production)

A second environment with the **same schema** is provisioned from these
migrations alone. The scoped Management API token used for dev cannot create
projects (`GET /v1/projects` returns `403`, verified 2026-10-14), so project
creation is a dashboard/user action:

1. Create a Free project in the Supabase dashboard and record its project
   reference, API URL and publishable key.
2. Apply every migration **in order** to the new project with the Management-API
   helper (or the CLI path below with that project's database password):

   ```sh
   $env:SUPABASE_MGMT_PROJECT_REF = "<new-project-ref>"
   node tests/live/apply-migration.mjs supabase/migrations/20261011000001_enrolment_foundation.sql
   node tests/live/apply-migration.mjs supabase/migrations/20261011000002_portal_signup_guard.sql
   node tests/live/apply-migration.mjs supabase/migrations/20261012000003_staff_auth_roles.sql
   ```

   This needs a `SUPABASE_MGMT_TOKEN` with access to the new project.
3. Re-apply the dev Auth configuration (D-020/D-024): sign-up disabled
   (`disable_signup = true`), the migration-0002 sign-up-guard Auth Hook
   enabled, and real SMTP for invitation email. The Free-plan pooler's 2/hour
   send budget and `@example.com` rejection above are **dev-only** limitations.
4. Point `.env.local` at the new project and run the live suite against it
   (`node tests/live/run-all.mjs`) to prove the schema and configuration on the
   new environment.

## Layout

```
supabase/
  config.toml            # CLI configuration (auth sign-up disabled by default)
  migrations/
    <UTC timestamp>_<description>.sql
```

- File names are `<UTC timestamp>_<description>.sql`, ordered lexicographically.
  Supabase applies them in that order.
- Migrations are append-only. Do not edit a migration that has been applied
  anywhere; add a new one instead.

## Applying migrations

### 1. Repeatable Management-API path (current, no extra credentials)

The migrations applied so far were applied in single transactions through the
Management API and recorded in `supabase_migrations.schema_migrations`
(version, statements, name) by the committed helper:

```sh
node tests/live/apply-migration.mjs supabase/migrations/20261012000003_staff_auth_roles.sql
```

Requires `SUPABASE_MGMT_TOKEN` and `SUPABASE_MGMT_PROJECT_REF` in the
environment (the same values used by the live session-refresh checks 06/07).
Only run this against an authorised **non-production** project.

### 2. Supabase CLI path (ready, needs one user-supplied value)

The repository is CLI-ready (`supabase/config.toml`, migrations named for the
CLI). The CLI path requires the project **database password**, which is never
stored in this repo; the owner can supply it and then:

```sh
npx supabase login                                        # scoped access token
npx supabase link --project-ref ysjumhlyqhoobywgqand      # prompts for db password
npx supabase db push                                      # applies pending migrations
```

`db push` compares against `supabase_migrations.schema_migrations`, so the
migrations already applied via the Management API are **skipped, not
re-applied**. This is the intended long-term workflow.

Never edit a deployed database by hand, and never push to a production project
without the approval described in `AUTOMATION_WORKFLOW.md` 4.

## Local verification

`npm test` applies **every** migration in this directory to a fresh PGlite
instance and asserts the tenant-isolation, fail-closed and audit invariants.
See `tests/database/` and `docs/PHASE0_RISK_REGISTER.md` 10.3.

Local tests prove the policy **logic**. They do not exercise Supabase Auth,
Auth Hooks, deployed grants or the Free-plan pooler, so they do not prove that a
deployed project is configured correctly — those checks run live
(`tests/live/`).