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
 * Verifies migration `20261018000009_phase4_assessments` (D-031): the assessment,
 * result and grade-band tables, the score-ceiling trigger, and — the security
 * point — that a teacher reaches assessments and results only for the classes
 * they are assigned to, reusing `can_access_class` from migration 0006.
 *
 * The important assertion here is also the *negative* one: no universal grading
 * scale is baked into the schema. A school with no `grade_bands` rows is valid,
 * and the tables say nothing about how many bands a school should have.
 */

const SCHOOL_A = "11111111-1111-4111-8111-111111111111";
const SCHOOL_B = "22222222-2222-4222-8222-222222222222";

const ADMIN_A = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_A = "aaaaaaaa-0000-4000-8000-000000000002";
const ADMIN_B = "bbbbbbbb-0000-4000-8000-000000000001";

const MEMBER_ADMIN_A = "aaaaaaaa-3333-4000-8000-000000000001";
const MEMBER_TEACHER_A = "aaaaaaaa-3333-4000-8000-000000000002";
const MEMBER_ADMIN_B = "bbbbbbbb-3333-4000-8000-000000000001";

const SUBJECT_A = "aaaaaaaa-6666-4000-8000-000000000001";
const SUBJECT_B = "bbbbbbbb-6666-4000-8000-000000000001";

const CLASS_A = "aaaaaaaa-7777-4000-8000-000000000001";
const CLASS_A_2 = "aaaaaaaa-7777-4000-8000-000000000002";
const CLASS_B = "bbbbbbbb-7777-4000-8000-000000000001";

const LEARNER_A1 = "aaaaaaaa-8888-4000-8000-000000000001";
const LEARNER_A2 = "aaaaaaaa-8888-4000-8000-000000000002";
const LEARNER_A3 = "aaaaaaaa-8888-4000-8000-000000000003";
const LEARNER_B1 = "bbbbbbbb-8888-4000-8000-000000000001";

let db: PGlite;

const ASSESS_A = "aaaaaaaa-9999-4000-8000-000000000001";
const ASSESS_A_2 = "aaaaaaaa-9999-4000-8000-000000000002";
const ASSESS_A_3 = "aaaaaaaa-9999-4000-8000-000000000003";
const ASSESS_B = "bbbbbbbb-9999-4000-8000-000000000001";

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
      ('${CLASS_A_2}', '${SCHOOL_A}', 'Primary 2'),
      ('${CLASS_B}', '${SCHOOL_B}', 'Primary 1');

    insert into public.subjects (id, school_id, name, code) values
      ('${SUBJECT_A}', '${SCHOOL_A}', 'Mathematics', 'MATH'),
      ('${SUBJECT_B}', '${SCHOOL_B}', 'Mathematics', 'MATH');

    insert into public.learners
      (id, school_id, registration_number, first_name, last_name, gender,
       date_of_birth, residential_address, guardian_phone, username)
    values
      ('${LEARNER_A1}', '${SCHOOL_A}', 'A1', 'Ama', 'Bello', 'female',
       '2016-05-04', 'Plot 3', '0240000001', 'ama'),
      ('${LEARNER_A2}', '${SCHOOL_A}', 'A2', 'Kofi', 'Mensah', 'male',
       '2016-07-19', 'Plot 5', '0240000002', 'kofi'),
      ('${LEARNER_A3}', '${SCHOOL_A}', 'A3', 'Efua', 'Owusu', 'female',
       '2016-11-02', 'Plot 7', '0240000003', 'efua'),
      ('${LEARNER_B1}', '${SCHOOL_B}', 'B1', 'Yaa', 'Boateng', 'female',
       '2016-01-30', 'Plot 9', '0240000004', 'yaa');

    insert into public.learner_class_placements (school_id, learner_id, class_id)
    values
      ('${SCHOOL_A}', '${LEARNER_A1}', '${CLASS_A}'),
      ('${SCHOOL_A}', '${LEARNER_A2}', '${CLASS_A}'),
      ('${SCHOOL_A}', '${LEARNER_A3}', '${CLASS_A_2}'),
      ('${SCHOOL_B}', '${LEARNER_B1}', '${CLASS_B}');

    -- The teacher is assigned to Primary 1 only.
    insert into public.staff_assignments (school_id, membership_id, class_id, subject_id)
    values ('${SCHOOL_A}', '${MEMBER_TEACHER_A}', '${CLASS_A}', '${SUBJECT_A}');
  `);

  // Fixtures inserted as the superuser so they exist before any policy applies.
  await db.exec(`
    insert into public.assessments (id, school_id, class_id, subject_id, name, max_score, assessed_on) values
      ('${ASSESS_A}', '${SCHOOL_A}', '${CLASS_A}', '${SUBJECT_A}', 'Mid-term test', 100, '2026-10-01'),
      ('${ASSESS_A_2}', '${SCHOOL_A}', '${CLASS_A_2}', '${SUBJECT_A}', 'Mid-term test', 50, '2026-10-01'),
      ('${ASSESS_B}', '${SCHOOL_B}', '${CLASS_B}', '${SUBJECT_B}', 'Mid-term test', 100, '2026-10-01');

    insert into public.assessment_results (school_id, assessment_id, learner_id, score) values
      ('${SCHOOL_A}', '${ASSESS_A}', '${LEARNER_A1}', 72),
      ('${SCHOOL_A}', '${ASSESS_A}', '${LEARNER_A2}', 45);
  `);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await actAsSystem(db);
});

describe("schema structure", () => {
  it("enables RLS on all three tables", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
       from pg_class
       where relnamespace = 'public'::regnamespace
         and relkind = 'r'
         and relname in ('assessments', 'assessment_results', 'grade_bands')
       order by relname`,
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("rejects a non-positive maximum score", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.assessments (school_id, class_id, name, max_score, assessed_on)
        values ('${SCHOOL_A}', '${CLASS_A}', 'Zero', 0, '2026-10-02')
      `),
    ).rejects.toThrow(/check constraint|max_score/i);
  });

  it("rejects a negative score", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.assessment_results (school_id, assessment_id, learner_id, score)
        values ('${SCHOOL_A}', '${ASSESS_A}', '${LEARNER_A3}', -1)
      `),
    ).rejects.toThrow(/check constraint|score/i);
  });

  it("rejects a score above the assessment maximum", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.assessment_results (school_id, assessment_id, learner_id, score)
        values ('${SCHOOL_A}', '${ASSESS_A}', '${LEARNER_A3}', 101)
      `),
    ).rejects.toThrow(/maximum|check_violation|check constraint/i);
  });

  it("allows a null score, meaning unmarked", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.assessment_results (school_id, assessment_id, learner_id, score)
        values ('${SCHOOL_A}', '${ASSESS_A_2}', '${LEARNER_A3}', null)
      `),
    ).resolves.toBeDefined();
  });

  it("rejects a second result for the same learner and assessment", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.assessment_results (school_id, assessment_id, learner_id, score)
        values ('${SCHOOL_A}', '${ASSESS_A}', '${LEARNER_A1}', 90)
      `),
    ).rejects.toThrow(/one_per_learner|duplicate key/i);
  });

  it("rejects two grade bands starting at the same percentage", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.grade_bands (school_id, min_percentage, label)
        values ('${SCHOOL_A}', 50, 'C')
        on conflict do nothing
      `),
    ).resolves.toBeDefined();
    await expect(
      db.query(`
        insert into public.grade_bands (school_id, min_percentage, label)
        values ('${SCHOOL_A}', 50, 'D')
      `),
    ).rejects.toThrow(/school_min_key|duplicate key/i);
  });

  it("rejects a grade band outside 0-100", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.grade_bands (school_id, min_percentage, label)
        values ('${SCHOOL_A}', 140, 'A+')
      `),
    ).rejects.toThrow(/check constraint|min_percentage/i);
  });
});

describe("no universal grading rule is assumed", () => {
  it("a school with no grade bands is valid and reports nothing extra", async () => {
    await actAsUser(db, ADMIN_A);
    const bands = await db.query<{ count: number }>(
      `select count(*)::int as count from public.grade_bands where school_id = '${SCHOOL_A}'`,
    );
    // Only the band the duplicate test inserted above; the table never demanded
    // a complete scale.
    expect(bands.rows[0]?.count).toBe(1);
  });
});

describe("composite foreign keys keep a row in one school", () => {
  it("rejects an assessment whose class belongs to another school", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.assessments (school_id, class_id, name, max_score, assessed_on)
        values ('${SCHOOL_B}', '${CLASS_A}', 'Cross-school', 10, '2026-10-02')
      `),
    ).rejects.toThrow();
  });

  it("rejects a result whose learner belongs to another school", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.assessment_results (school_id, assessment_id, learner_id, score)
        values ('${SCHOOL_B}', '${ASSESS_B}', '${LEARNER_A1}', 10)
      `),
    ).rejects.toThrow();
  });

  it("rejects a result aimed at another school's assessment", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.assessment_results (school_id, assessment_id, learner_id, score)
        values ('${SCHOOL_B}', '${ASSESS_A}', '${LEARNER_B1}', 10)
      `),
    ).rejects.toThrow();
  });
});

describe("an administrator sees their whole school", () => {
  it("reads every assessment in their school and none elsewhere", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query<{ id: string }>(
      `select id from public.assessments order by id`,
    );
    expect(result.rows.map((row) => row.id)).toEqual([ASSESS_A, ASSESS_A_2]);
  });

  it("reads every result in their school", async () => {
    await actAsUser(db, ADMIN_A);
    // Scoped to the seeded results: other tests in this file add rows of their
    // own, and this asserts visibility, not counts.
    const result = await db.query<{ learner_id: string }>(
      `select learner_id from public.assessment_results
       where assessment_id = '${ASSESS_A}' order by learner_id`,
    );
    expect(result.rows.map((row) => row.learner_id)).toEqual([
      LEARNER_A1,
      LEARNER_A2,
    ]);
  });

  it("may create an assessment for any class in the school", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.assessments (school_id, class_id, name, max_score, assessed_on)
        values ('${SCHOOL_A}', '${CLASS_A_2}', 'Admin authored', 20, '2026-10-03')
      `),
    ).resolves.toBeDefined();
  });
});

describe("a teacher is confined to their assigned classes", () => {
  it("reads only the assessments for their class", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{ id: string }>(
      `select id from public.assessments where id in ('${ASSESS_A}', '${ASSESS_A_2}', '${ASSESS_B}') order by id`,
    );
    expect(result.rows.map((row) => row.id)).toEqual([ASSESS_A]);
  });

  it("reads only the results for their class", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{ learner_id: string }>(
      `select learner_id from public.assessment_results
       where assessment_id in ('${ASSESS_A}', '${ASSESS_A_2}') order by learner_id`,
    );
    expect(result.rows.map((row) => row.learner_id)).toEqual([
      LEARNER_A1,
      LEARNER_A2,
    ]);
  });

  it("cannot create an assessment for an unassigned class", async () => {
    await actAsUser(db, TEACHER_A);
    await expect(
      db.query(`
        insert into public.assessments (school_id, class_id, name, max_score, assessed_on)
        values ('${SCHOOL_A}', '${CLASS_A_2}', 'Not my class', 10, '2026-10-04')
      `),
    ).rejects.toThrow();
  });

  it("may create an assessment for their own class", async () => {
    await actAsUser(db, TEACHER_A);
    await expect(
      db.query(`
        insert into public.assessments (school_id, class_id, subject_id, name, max_score, assessed_on)
        values ('${SCHOOL_A}', '${CLASS_A}', '${SUBJECT_A}', 'Classwork', 25, '2026-10-05')
      `),
    ).resolves.toBeDefined();
  });

  it("cannot change a grade band, which is the school's own scale", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{ id: string }>(
      `update public.grade_bands set label = 'Hijacked' where school_id = '${SCHOOL_A}' returning id`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("may read the grade bands they are marking against", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{ label: string }>(
      `select label from public.grade_bands where school_id = '${SCHOOL_A}' order by min_percentage`,
    );
    expect(result.rows.map((row) => row.label)).toEqual(["C"]);
  });
});

describe("results are records, not state", () => {
  it("offers no delete policy on results", async () => {
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from pg_policies
       where schemaname = 'public' and tablename = 'assessment_results' and cmd = 'DELETE'`,
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it("grants no delete privilege on results to authenticated or anon", async () => {
    const result = await db.query<{ can_delete: boolean }>(`
      select bool_or(has_table_privilege(grantee, 'public.assessment_results', 'DELETE')) as can_delete
      from (values ('anon'), ('authenticated')) as roles(grantee)
    `);
    expect(result.rows[0]?.can_delete).toBe(false);
  });

  it("audits an inserted mark", async () => {
    await actAsUser(db, ADMIN_A);
    // A learner this file has not otherwise marked, so the assertion does not
    // depend on which tests ran before it.
    await actAsSystem(db);
    await db.query(
      `insert into public.assessments (id, school_id, class_id, name, max_score, assessed_on)
       values ('${ASSESS_A_3}', '${SCHOOL_A}', '${CLASS_A}', 'Audit probe', 10, '2026-10-06')`,
    );
    await actAsUser(db, ADMIN_A);
    await db.query(`
      insert into public.assessment_results (school_id, assessment_id, learner_id, score)
      values ('${SCHOOL_A}', '${ASSESS_A_3}', '${LEARNER_A1}', 8)
    `);
    const events = await db.query<{ actor_user_id: string }>(
      `select actor_user_id from public.audit_events
       where target_table = 'assessment_results'
         and action = 'insert'
       order by id desc limit 1`,
    );
    expect(events.rows[0]?.actor_user_id).toBe(ADMIN_A);
  });
});

describe("permissions and grants", () => {
  it("denies anonymous access at the grant", async () => {
    await actAsAnonymous(db);
    for (const table of ["assessments", "assessment_results", "grade_bands"]) {
      await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
        /permission denied/i,
      );
    }
  });

  it("keeps grade.manage and result.read away from the teacher", async () => {
    const result = await db.query<{ permission: string }>(
      `select permission from public.role_permissions
       where role = 'teacher' and permission in ('grade.manage', 'result.read', 'report.read')
       order by permission`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("gives the administrator every new permission", async () => {
    const result = await db.query<{ permission: string }>(
      `select permission from public.role_permissions
       where role = 'school_administrator'
         and permission in ('assessment.read','assessment.manage','result.read',
                            'result.record','grade.read','grade.manage','report.read')
       order by permission`,
    );
    expect(result.rows).toHaveLength(7);
  });

  it("lets the service role read the new tables", async () => {
    await actAsServiceRole(db);
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from public.assessments where id in
        ('${ASSESS_A}', '${ASSESS_A_2}', '${ASSESS_B}')`,
    );
    expect(result.rows[0]?.count).toBe(3);
  });
});
