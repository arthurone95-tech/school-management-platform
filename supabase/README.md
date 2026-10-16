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
- `20261015000004_staff_invitations.sql` — shareable staff-invitation credential
  store (D-025); **applied live** to `school-management-dev` on 2026-10-15 and
  verified locally (unit/database tests) and live (`tests/live/09-staff-auth.mjs`,
  44/44)

No production database exists; the Free dev project is a **disposable,
non-production** environment (D-013, D-015).

**Staff invitations no longer use email (D-025).** The earlier email-delivery
design (and its dev-only caveats: the Free-plan shared pooler rejects
`@example.com` recipients at send time, budgets sends at 2/hour, and refuses
template editing) has been replaced by a **shareable activation link**
`<origin>/join#token=<64-hex>`. Invitation creation sends no email and returns
the link; the administrator shares it out of band. The token lives in the URL
fragment so it never reaches a server/proxy/analytics log, only a keyed hash is
stored (`staff_invitations.credential_hash`), and it is single-use with a
72-hour expiry. This removes both email caveats above entirely; `/auth/confirm`
and `/api/staff/set-password` were removed with the old flow. The app-side chain
(preview → accept → sign-in, plus revoke/re-invite) is covered by
`tests/live/09-staff-auth.mjs`.

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
   node tests/live/apply-migration.mjs supabase/migrations/20261015000004_staff_invitations.sql
   ```

   This needs a `SUPABASE_MGMT_TOKEN` with access to the new project.
3. Re-apply the dev Auth configuration (D-020/D-024): sign-up disabled
   (`disable_signup = true`) and the migration-0002 sign-up-guard Auth Hook
   enabled. Staff invitations (D-025) send no email, so no SMTP configuration is
   required for them.
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
node tests/live/apply-migration.mjs supabase/migrations/20261015000004_staff_invitations.sql
```

Requires `SUPABASE_MGMT_TOKEN` and `SUPABASE_MGMT_PROJECT_REF` in the
environment (the same values used by the live session-refresh checks 06/07).
Only run this against an authorised **non-production** project. Migration
`20261015000004_staff_invitations.sql` (D-025) was applied to
`school-management-dev` this way on 2026-10-15, before the D-025 staff-auth live
suite was run against it (44/44 passing).

### 2. Supabase CLI path (ready, needs one user-supplied value)

The repository is CLI-ready (`supabase/config.toml`, migrations named for the
CLI). On this workstation the CLI is invoked as `npx supabase@latest` (a cached
bare `npx supabase` resolved a package missing the win32-x64 platform binary and
failed to start). Verified 2026-10-15: the remote
`supabase_migrations.schema_migrations` held exactly the three then-local
migrations (matching `version` and `name`); `20261015000004` was afterwards
applied through the Management API and recorded, so `db push` now lists nothing
to apply.
The CLI path still requires the project **database password**, which is never
stored in this repo; the owner can supply it locally and then:

```sh
npx supabase@latest login                                     # scoped access token (or interactive)
npx supabase@latest link --project-ref ysjumhlyqhoobywgqand   # prompts for the db password
npx supabase@latest db push --linked --dry-run                # safe check: should list nothing (all applied)
npx supabase@latest db push --linked                          # only if the dry-run lists work
```

`db push` compares against `supabase_migrations.schema_migrations`, so the
migrations already applied via the Management API are **skipped, not
re-applied** (`supabase migration list --linked` prints the same history). This
is the intended long-term workflow. Without linking, the same history can be
read read-only through the Management API —

`POST /v1/projects/<ref>/database/query` with
`{"query":"select version, name from supabase_migrations.schema_migrations order by version"}`

— and compared with the files in `supabase/migrations/`.

Never edit a deployed database by hand, and never push to a production project
without the approval described in `AUTOMATION_WORKFLOW.md` 4.

## Local verification

`npm test` applies **every** migration in this directory to a fresh PGlite
instance and asserts the tenant-isolation, fail-closed and audit invariants,
including the `staff_invitations` server-only store. See `tests/database/` and
`docs/PHASE0_RISK_REGISTER.md` 10.3.

Local tests prove the policy **logic**. They do not exercise Supabase Auth,
Auth Hooks, deployed grants or the Free-plan pooler, so they do not prove that a
deployed project is configured correctly — those checks run live
(`tests/live/`).
