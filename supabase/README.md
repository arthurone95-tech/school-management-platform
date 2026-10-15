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

**Email-template limitation (verified 2026-10-15).** On the Free plan with the
default mailer, editing the Auth email templates is **refused** by the
Management API: "Email template modification is not available for free tier
projects using the default email provider. Please upgrade your plan or
configure a custom SMTP provider." The invitation template therefore cannot be
pointed at the app's `/auth/confirm`. The default template routes through
Supabase's own `/auth/v1/verify`, which 303-redirects to the app with the
session in the URL **fragment** (`…/auth/confirm#access_token=…`); a server
route never receives a fragment, and the app's SSR model requires a `token_hash`
query parameter. Consequence: **the real invitation-email click cannot complete
acceptance** until a custom SMTP provider (which also unlocks template editing)
or an upgraded plan is configured, and the invite template is set to
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/join`.
The app-side chain (`/auth/confirm` → `/join` → set-password → sign-in) is
verified independently with a generated single-use token
(`tests/live/09-staff-auth.mjs`, `/api/staff/invite` renders the flow).

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
CLI). On this workstation the CLI is invoked as `npx supabase@latest` (a cached
bare `npx supabase` resolved a package missing the win32-x64 platform binary and
failed to start). Verified 2026-10-15: the remote
`supabase_migrations.schema_migrations` holds exactly the three local
migrations (matching `version` and `name`), so `db push` has nothing to apply.
The CLI path still requires the project **database password**, which is never
stored in this repo; the owner can supply it locally and then:

```sh
npx supabase@latest login                                     # scoped access token (or interactive)
npx supabase@latest link --project-ref ysjumhlyqhoobywgqand   # prompts for the db password
npx supabase@latest db push --linked --dry-run                # safe check: should list nothing to apply
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
instance and asserts the tenant-isolation, fail-closed and audit invariants.
See `tests/database/` and `docs/PHASE0_RISK_REGISTER.md` 10.3.

Local tests prove the policy **logic**. They do not exercise Supabase Auth,
Auth Hooks, deployed grants or the Free-plan pooler, so they do not prove that a
deployed project is configured correctly — those checks run live
(`tests/live/`).