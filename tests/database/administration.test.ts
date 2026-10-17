import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  actAsAnonymous,
  actAsServiceRole,
  actAsSystem,
  actAsUser,
  createTestDatabase,
} from "./harness";

/**
 * Verifies migration `20261016000005_phase3_administration` (D-029): the shape
 * of the new tables, the composite foreign keys that keep every row inside one
 * school, and the Row Level Security policies. Runs against a local WASM
 * PostgreSQL; the harness explains why this does not replace verification
 * against a real non-production Supabase project.
 */

const SCHOOL_A = "11111111-1111-4111-8111-111111111111";
const SCHOOL_B = "22222222-2222-4222-8222-222222222222";

const ADMIN_A = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_A = "aaaaaaaa-0000-4000-8000-000000000002";
const ADMIN_B = "bbbbbbbb-0000-4000-8000-000000000001";

const MEMBER_ADMIN_A = "aaaaaaaa-3333-4000-8000-000000000001";
const MEMBER_TEACHER_A = "aaaaaaaa-3333-4000-8000-000000000002";
const MEMBER_ADMIN_B = "bbbbbbbb-3333-4000-8000-000000000001";

const YEAR_A = "aaaaaaaa-4444-4000-8000-000000000001";
const YEAR_B = "bbbbbbbb-4444-4000-8000-000000000001";

const TERM_A = "aaaaaaaa-5555-4000-8000-000000000001";

const SUBJECT_A = "aaaaaaaa-6666-4000-8000-000000000001";
const SUBJECT_B = "bbbbbbbb-6666-4000-8000-000000000001";

const CLASS_A = "aaaaaaaa-7777-4000-8000-000000000001";
const CLASS_B = "bbbbbbbb-7777-4000-8000-000000000001";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();

  await db.exec(`
    insert into public.schools (id, name, code) values
      ('${SCHOOL_A}', 'Alpha Basic School', 'ALPHA01'),
      ('${SCHOOL_B}', 'Brave Basic School', 'BRAVE12');

    insert into auth.users (id) values
      ('${ADMIN_A}'), ('${TEACHER_A}'), ('${ADMIN_B}');

    insert into public.school_members (id, school_id, user_id, role, status) values
      ('${MEMBER_ADMIN_A}', '${SCHOOL_A}', '${ADMIN_A}', 'school_administrator', 'active'),
      ('${MEMBER_TEACHER_A}', '${SCHOOL_A}', '${TEACHER_A}', 'teacher', 'active'),
      ('${MEMBER_ADMIN_B}', '${SCHOOL_B}', '${ADMIN_B}', 'school_administrator', 'active');

    insert into public.classes (id, school_id, name) values
      ('${CLASS_A}', '${SCHOOL_A}', 'Primary 1'),
      ('${CLASS_B}', '${SCHOOL_B}', 'Primary 1');

    insert into public.academic_years (id, school_id, name, starts_on, ends_on, is_current) values
      ('${YEAR_A}', '${SCHOOL_A}', '2025/2026', '2025-09-01', '2026-07-31', true),
      ('${YEAR_B}', '${SCHOOL_B}', '2025/2026', '2025-09-01', '2026-07-31', true);

    insert into public.terms (id, school_id, academic_year_id, name, starts_on, ends_on) values
      ('${TERM_A}', '${SCHOOL_A}', '${YEAR_A}', 'Term 1', '2025-09-01', '2025-12-19');

    insert into public.subjects (id, school_id, name, code) values
      ('${SUBJECT_A}', '${SCHOOL_A}', 'Mathematics', 'MATH'),
      ('${SUBJECT_B}', '${SCHOOL_B}', 'Mathematics', 'MATH');
  `);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await actAsSystem(db);
});

describe("schema structure", () => {
  it("enables RLS on every new tenant-owned table", async () => {
    const result = await db.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(`
      select relname, relrowsecurity
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relkind = 'r'
        and relname in ('academic_years', 'terms', 'subjects', 'staff_assignments')
      order by relname
    `);

    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("enforces at most one current academic year per school", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.academic_years
          (school_id, name, starts_on, ends_on, is_current)
        values
          ('${SCHOOL_A}', '2026/2027', '2026-09-01', '2027-07-31', true)
      `),
    ).rejects.toThrow(/academic_years_one_current_idx|duplicate key/);
  });

  it("rejects a second identical staff assignment", async () => {
    await actAsUser(db, ADMIN_A);
    await db.query(
      `insert into public.staff_assignments (school_id, membership_id, class_id)
         values ('${SCHOOL_A}', '${MEMBER_TEACHER_A}', '${CLASS_A}')`,
    );
    await expect(
      db.query(
        `insert into public.staff_assignments (school_id, membership_id, class_id)
         values ('${SCHOOL_A}', '${MEMBER_TEACHER_A}', '${CLASS_A}')`,
      ),
    ).rejects.toThrow();
  });
});

describe("school isolation", () => {
  it("shows an administrator only their own school's rows", async () => {
    await actAsUser(db, ADMIN_A);

    const years = await db.query<{ id: string }>(
      `select id from public.academic_years order by id`,
    );
    expect(years.rows.map((row) => row.id)).toEqual([YEAR_A]);

    const subjects = await db.query<{ id: string }>(
      `select id from public.subjects order by id`,
    );
    expect(subjects.rows.map((row) => row.id)).toEqual([SUBJECT_A]);

    const terms = await db.query<{ id: string }>(
      `select id from public.terms order by id`,
    );
    expect(terms.rows.map((row) => row.id)).toEqual([TERM_A]);
  });

  it("refuses an insert aimed at another school", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.subjects (school_id, name)
        values ('${SCHOOL_B}', 'Cross-school subject')
      `),
    ).rejects.toThrow();
  });

  it("touches no rows when an update targets another school", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query(`
      update public.subjects set name = 'Hijacked'
      where id = '${SUBJECT_B}' returning id
    `);
    expect(result.rows).toHaveLength(0);
  });

  it("updates its own school but not another's", async () => {
    await actAsUser(db, ADMIN_A);
    const own = await db.query(
      `update public.schools set name = 'Alpha Renamed' where id = '${SCHOOL_A}' returning id`,
    );
    expect(own.rows).toHaveLength(1);

    const other = await db.query(
      `update public.schools set name = 'Bravo Hijacked' where id = '${SCHOOL_B}' returning id`,
    );
    expect(other.rows).toHaveLength(0);
  });
});

describe("permissions", () => {
  it("lets a permission-less teacher read nothing new", async () => {
    await actAsUser(db, TEACHER_A);

    const years = await db.query(`select id from public.academic_years`);
    expect(years.rows).toHaveLength(0);

    const subjects = await db.query(`select id from public.subjects`);
    expect(subjects.rows).toHaveLength(0);

    const assignments = await db.query(
      `select id from public.staff_assignments`,
    );
    expect(assignments.rows).toHaveLength(0);
  });

  it("refuses a teacher insert even for their own school", async () => {
    await actAsUser(db, TEACHER_A);
    await expect(
      db.query(`
        insert into public.subjects (school_id, name)
        values ('${SCHOOL_A}', 'Teacher-made subject')
      `),
    ).rejects.toThrow();
  });

  it("denies anonymous reads at the grant, before RLS", async () => {
    await actAsAnonymous(db);
    await expect(
      db.query(`select id from public.academic_years`),
    ).rejects.toThrow(/permission denied/i);
  });

  it("revokes a suspended manager's access immediately", async () => {
    await db.query(
      `update public.school_members set status = 'suspended' where id = '${MEMBER_ADMIN_A}'`,
    );
    await actAsUser(db, ADMIN_A);
    const years = await db.query(`select id from public.academic_years`);
    expect(years.rows).toHaveLength(0);
    // Restore for the remaining tests.
    await actAsSystem(db);
    await db.query(
      `update public.school_members set status = 'active' where id = '${MEMBER_ADMIN_A}'`,
    );
  });
});

describe("composite foreign keys keep a row in one school", () => {
  it("rejects a term whose year belongs to another school", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.terms (school_id, academic_year_id, name, starts_on, ends_on)
        values ('${SCHOOL_A}', '${YEAR_B}', 'Term X', '2026-01-01', '2026-03-01')
      `),
    ).rejects.toThrow();
  });

  it("rejects an assignment whose class belongs to another school", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.staff_assignments (school_id, membership_id, class_id)
        values ('${SCHOOL_B}', '${MEMBER_ADMIN_B}', '${CLASS_A}')
      `),
    ).rejects.toThrow();
  });
});

describe("grants", () => {
  it("leaves the new tables inaccessible to the anonymous role", async () => {
    const result = await db.query<{ can_select: boolean }>(`
      select bool_or(has_table_privilege('anon', format('public.%s', tablename), 'SELECT')) as can_select
      from pg_tables
      where schemaname = 'public'
        and tablename in ('academic_years', 'terms', 'subjects', 'staff_assignments')
    `);
    expect(result.rows[0]?.can_select).toBe(false);
  });

  it("grants the authenticated role access to the new tables", async () => {
    const result = await db.query<{ can_select: boolean }>(`
      select bool_and(has_table_privilege('authenticated', format('public.%s', tablename), 'SELECT')) as can_select
      from pg_tables
      where schemaname = 'public'
        and tablename in ('academic_years', 'terms', 'subjects', 'staff_assignments')
    `);
    expect(result.rows[0]?.can_select).toBe(true);
  });

  it("lets the service role bypass RLS on the new tables", async () => {
    await actAsServiceRole(db);
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from public.subjects`,
    );
    expect(result.rows[0]?.count).toBe(2);
  });
});
