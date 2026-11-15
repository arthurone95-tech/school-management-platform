# Go-Live Checklist

**Purpose:** Step-by-step guide to take the School Management Platform from development to pilot-ready state.

This checklist covers: production Supabase project setup, migrations, environment variables, deployment, and owner account creation. Read each step carefully and complete before moving on.

---

## 1. Create the Production Supabase Project

| # | Action | Details |
|---|--------|---------|
| 1.1 | provision a new Supabase project for production | Use the Supabase dashboard or CLI: `npx supabase projects create school-management-prod --organization=your-org` |
| 1.2 | select the production plan | **The Supabase Free plan is not a production configuration** (see DEPLOYMENT_AND_OPERATIONS.md §2). Review and approve the production plan's limits, cost, and backup capabilities before onboarding any real school. |
| 1.3 | enable required extensions | logextension, pgvector (if needed for assessment features) |
| 1.4 | note the project ref and URL | You'll need these for environment variable configuration |

---

## 2. Apply Database Migrations

| # | Action | Details |
|---|--------|---------|
| 2.1 | verify migrations are present | Check `supabase/migrations/` directory. All Phase 0–5 migrations must be present and numbered sequentially. |
| 2.2 | apply migrations to the production project | `npx supabase db push --linked --plan=production` <br>or<br>`npx supabase migration deploy --all --linked` |
| 2.3 | validate migration success | Run the live verification suite: `node tests/live/run-all.mjs` <br>(Set `SUPABASE_MGMT_TOKEN` and `SUPABASE_MGMT_PROJECT_REF` if step 06/07/15 need to run) |
| 2.4 | confirm key schema is present | `grade_bands`, `assessments`, `assessment_results`, `schools` tables with correct columns |
| 2.5 | backup the dev project schema (optional but recommended) | `npx supabase db dump --linked > dev-schema-backup.sql` |

---

## 3. Set Environment Variables

| # | Variable | Value | Notes |
|---|----------|-------|-------|
| 3.1 | `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase project URL | Can be public (frontend-safe) |
| 3.2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase anon key | Can be public; does not grant admin access |
| 3.3 | `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret** | Never commit to repo; set via hosting provider secrets manager |
| 3.4 | `PROVISIONING_SECRET` | Shared secret for `/api/admin/provision-school` | Must match the header `x-provision-secret`; keep secret |
| 3.5 | `SUPABASE_MGMT_TOKEN` | Management API token (optional) | Required for live suite steps 06/07/15 |
| 3.6 | `SUPABASE_MGMT_PROJECT_REF` | Supabase project ref for management API | Required for live suite steps 06/07/15 |
| 3.7 | `.env.example` | Updated with variable names and safe placeholders | Commit this file; do NOT commit real values |

**Security:** Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PROVISIONING_SECRET`) must never be exposed in client bundles, logs, or documentation. Use the hosting provider's secret-management mechanism (Vercel, Netlify, etc.) to inject them at deploy time.

---

## 4. Deploy to Hosting Provider

| # | Action | Details |
|---|--------|---------|
| 4.1 | verify hosting compatibility | Next.js 16.4.3+ compatibility with chosen provider (Vercel recommended per DEPLOYMENT_AND_OPERATIONS.md §3) |
| 4.2 | configure build settings | `NEXT_PUBLIC_MODE=production`; enable Node.js compatibility if needed |
| 4.3 | inject secrets via hosting provider | Add `SUPABASE_SERVICE_ROLE_KEY`, `PROVISIONING_SECRET` etc. as secret environment variables in the hosting dashboard |
| 4.4 | initial deployment | `npm run build && npm start` <br>or deploy via CLI: `vercel --prod` |
| 4.4 | verify the deployed app works | Visit the URL, sign in with a test account, confirm pages load correctly |
| 4.5 | set up custom domain (optional) | Configure HTTPS with a valid certificate; update `NEXT_PUBLIC_SUPABASE_URL` if domain changes |
| 4.6 | post-deployment smoke test | Run through critical workflows: sign in, create a school, take attendance, enter marks |

---

## 5. Create the Platform Owner Account

| # | Action | Details |
|---|--------|---------|
| 5.1 | sign in to the Supabase dashboard | Use the production project URL |
| 5.2 | go to Authentication → Users | Add a new user with a dedicated email (e.g., `owner@school.example`) |
| 5.3 | set a secure password | Or mark the user as `email_confirmed: true` and set a password via the admin API |
| 5.4 | set app_metadata to identify the owner | `{"platform_owner": true}` <br>(This is how the `/owner` page identifies the platform owner) |
| 5.5 | note the user ID and email | You'll use these to sign in as the owner |
| 5.6 | test the `/owner` page | Navigate to `http://your-domain/owner` — should show school list and create form |

---

## 6. Post-Deployment Verification

| # | Action | Details |
|---|--------|---------|
| 6.1 | run cross-school isolation tests | Verify a user from School A cannot access School B's data |
| 6.2 | test the `/owner` page | List schools, create a new school, verify admin sign-in details appear |
| 6.3 | test attendance and marks entry | As a teacher, complete a full attendance register and marks entry flow |
| 6.4 | test export functionality | Verify CSV export is bounded (5000 rows max) and includes audit trail |
| 6.4 | test invitation flow | Invite a teacher to a school; verify single-use activation link |
| 6.5 | confirm RLS policies are active | Run the security test suite: `npx vitest run tests/` |
| 6.6 | document known limitations | Note any unresolved risks or unfinished features |

---

## 7. Pilot Preparation

| # | Action | Details |
|---|--------|---------|
| 7.1 | identify and authorize pilot school(s) | Obtain written consent from school leadership; define scope of what they may do |
| 7.2 | brief the pilot school | Provide training on attendance, marks entry, exports, and data boundaries |
| 7.3 | on-board the school | Create their school workspace via the owner screen; assign the first administrator |
| 7.4 | conduct on-site testing | Verify the app works on the school's devices and network conditions |
| 7.5 | set monitoring | Enable error reporting and alert monitoring per DEPLOYMENT_AND_OPERATIONS.md §8 |
| 7.6 | schedule review checkpoints | 2-week and 4-week check-ins to assess usage and issues |

---

## Approval

Before declaring production readiness, the owner must confirm:

- [ ] Production Supabase plan is validated and approved
- [ ] All migrations applied and live suite passes
- [ ] Environment variables are set (no secrets in repo)
- [ ] Deployment is live and smoke-tested
- [ ] Owner account created with `platform_owner` app_metadata
- [ ] Cross-school isolation verified
- [ ] Privacy/legal review completed (Ghana Data Protection Act, 2012)
- [ ] Backups configured and restoration tested
- [ ] Monitoring and incident response procedures documented

**Do not declare production readiness until all prerequisites are met.**

---

*Document generated for the School Management Platform pilot readiness program.*