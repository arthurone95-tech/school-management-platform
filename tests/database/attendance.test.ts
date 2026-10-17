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
 * Verifies migrations `20261017000006_phase4_attendance` and
 * `20261017000007_phase4_attendance_scope` (D-030): the attendance tables, the
 * composite foreign keys that keep every row in one school, and — most
 * importantly — the class-scoped Row Level Security that keeps a teacher inside
 * the classes they are assigned to.
 *
 * The PGlite harness is a hardening requirement, not a substitute for the live
 * suite: it recreates only the small part of Supabase the migrations use.
 */

const SCHOOL_A = "11111111-1111-4111-8111-111111111111";
const SCHOOL_B = "22222222-2222-4222-8222-222222222222";

const ADMIN_A = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_A = "aaaaaaaa-0000-4000-8000-000000000002";
/** A second teacher in school A who is deliberately assigned to nothing. */
const UNASSIGNED_TEACHER_A = "aaaaaaaa-0000-4000-8000-000000000003";
const ADMIN_B = "bbbbbbbb-0000-4000-8000-000000000001";

const MEMBER_ADMIN_A = "aaaaaaaa-3333-4000-8000-000000000001";
const MEMBER_TEACHER_A = "aaaaaaaa-3333-4000-8000-000000000002";
const MEMBER_UNASSIGNED_A = "aaaaaaaa-3333-4000-8000-000000000003";
const MEMBER_ADMIN_B = "bbbbbbbb-3333-4000-8000-000000000001";

const SUBJECT_A = "aaaaaaaa-6666-4000-8000-000000000001";
const SUBJECT_OTHER_A = "aaaaaaaa-6666-4000-8000-000000000002";
const SUBJECT_B = "bbbbbbbb-6666-4000-8000-000000000001";

const CLASS_A = "aaaaaaaa-7777-4000-8000-000000000001";
/** A second class in school A that only the administrator is assigned to. */
const CLASS_A_2 = "aaaaaaaa-7777-4000-8000-000000000002";
const CLASS_B = "bbbbbbbb-7777-4000-8000-000000000001";

const LEARNER_A1 = "aaaaaaaa-8888-4000-8000-000000000001";
const LEARNER_A2 = "aaaaaaaa-8888-4000-8000-000000000002";
const LEARNER_A3 = "aaaaaaaa-8888-4000-8000-000000000003";
const LEARNER_B1 = "bbbbbbbb-8888-4000-8000-000000000001";

const SESSION_DATE = "2026-10-17";

let db: PGlite;

/** Inserts a session as the superuser, bypassing RLS, for use as a fixture. */
async function seedSession(
  id: string,
  schoolId: string,
  classId: string,
  subjectId: string | null,
  date: string,
): Promise<void> {
  await db.query(
    `insert into public.attendance_sessions (id, school_id, class_id, subject_id, session_date)
     values ($1, $2, $3, $4, $5)`,
    [id, schoolId, classId, subjectId, date],
  );
}

async function seedRecord(
  id: string,
  sessionId: string,
  schoolId: string,
  learnerId: string,
  status: string,
): Promise<void> {
  await db.query(
    `insert into public.attendance_records (id, school_id, session_id, learner_id, status)
     values ($1, $2, $3, $4, $5)`,
    [id, schoolId, sessionId, learnerId, status],
  );
}

beforeAll(async () => {
  db = await createTestDatabase();

  await db.exec(`
    insert into public.schools (id, name, code) values
      ('${SCHOOL_A}', 'Alpha Basic School', 'ALPHA01'),
      ('${SCHOOL_B}', 'Brave Basic School', 'BRAVE12');

    insert into auth.users (id) values
      ('${ADMIN_A}'), ('${TEACHER_A}'), ('${UNASSIGNED_TEACHER_A}'), ('${ADMIN_B}');

    insert into public.school_members (id, school_id, user_id, role, status) values
      ('${MEMBER_ADMIN_A}', '${SCHOOL_A}', '${ADMIN_A}', 'school_administrator', 'active'),
      ('${MEMBER_TEACHER_A}', '${SCHOOL_A}', '${TEACHER_A}', 'teacher', 'active'),
      ('${MEMBER_UNASSIGNED_A}', '${SCHOOL_A}', '${UNASSIGNED_TEACHER_A}', 'teacher', 'active'),
      ('${MEMBER_ADMIN_B}', '${SCHOOL_B}', '${ADMIN_B}', 'school_administrator', 'active');

    insert into public.classes (id, school_id, name) values
      ('${CLASS_A}', '${SCHOOL_A}', 'Primary 1'),
      ('${CLASS_A_2}', '${SCHOOL_A}', 'Primary 2'),
      ('${CLASS_B}', '${SCHOOL_B}', 'Primary 1');

    insert into public.subjects (id, school_id, name, code) values
      ('${SUBJECT_A}', '${SCHOOL_A}', 'Mathematics', 'MATH'),
      ('${SUBJECT_OTHER_A}', '${SCHOOL_A}', 'English', 'ENG'),
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
      ('${SCHOOL_A}', '${LEARNER_A3}', '${CLASS_A}'),
      ('${SCHOOL_B}', '${LEARNER_B1}', '${CLASS_B}');

    -- The teacher owns Mathematics in Primary 1 and nothing else. The
    -- unassigned teacher owns no class at all.
    insert into public.staff_assignments (school_id, membership_id, class_id, subject_id)
    values
      ('${SCHOOL_A}', '${MEMBER_TEACHER_A}', '${CLASS_A}', '${SUBJECT_A}'),
      ('${SCHOOL_A}', '${MEMBER_UNASSIGNED_A}', null, '${SUBJECT_A}'),
      ('${SCHOOL_A}', '${MEMBER_ADMIN_A}', '${CLASS_A_2}', '${SUBJECT_OTHER_A}');
  `);

  await seedSession(
    "aaaaaaaa-9999-4000-8000-000000000001",
    SCHOOL_A,
    CLASS_A,
    SUBJECT_A,
    SESSION_DATE,
  );
  await seedSession(
    "aaaaaaaa-9999-4000-8000-000000000002",
    SCHOOL_A,
    CLASS_A_2,
    SUBJECT_OTHER_A,
    SESSION_DATE,
  );
  await seedSession(
    "bbbbbbbb-9999-4000-8000-000000000001",
    SCHOOL_B,
    CLASS_B,
    SUBJECT_B,
    SESSION_DATE,
  );

  await seedRecord(
    "aaaaaaaa-aaaa-4000-8000-000000000001",
    "aaaaaaaa-9999-4000-8000-000000000001",
    SCHOOL_A,
    LEARNER_A1,
    "present",
  );
  await seedRecord(
    "aaaaaaaa-aaaa-4000-8000-000000000002",
    "aaaaaaaa-9999-4000-8000-000000000001",
    SCHOOL_A,
    LEARNER_A2,
    "absent",
  );
  await seedRecord(
    "bbbbbbbb-aaaa-4000-8000-000000000001",
    "bbbbbbbb-9999-4000-8000-000000000001",
    SCHOOL_B,
    LEARNER_B1,
    "late",
  );
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await actAsSystem(db);
});

describe("schema structure", () => {
  it("enables RLS on both attendance tables", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
       from pg_class
       where relnamespace = 'public'::regnamespace
         and relkind = 'r'
         and relname in ('attendance_sessions', 'attendance_records')
       order by relname`,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("constrains the status to the four approved values", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.attendance_records (school_id, session_id, learner_id, status)
        values ('${SCHOOL_A}', 'aaaaaaaa-9999-4000-8000-000000000001',
                '${LEARNER_A3}', 'unwell')
      `),
    ).rejects.toThrow(/attendance_records_status_check|check constraint/i);
  });

  it("rejects a second record for the same learner in the same session", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.attendance_records (school_id, session_id, learner_id, status)
        values ('${SCHOOL_A}', 'aaaaaaaa-9999-4000-8000-000000000001',
                '${LEARNER_A1}', 'late')
      `),
    ).rejects.toThrow(/attendance_records_one_per_learner|duplicate key/i);
  });

  it("rejects a second session for the same class, date and subject", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`
        insert into public.attendance_sessions (school_id, class_id, subject_id, session_date)
        values ('${SCHOOL_A}', '${CLASS_A}', '${SUBJECT_A}', '${SESSION_DATE}')
      `),
    ).rejects.toThrow(/one_per_class_date_subject|duplicate key/i);
  });

  it("offers no delete policy at all, so a register cannot be removed", async () => {
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count
       from pg_policies
       where schemaname = 'public'
         and tablename in ('attendance_sessions', 'attendance_records')
         and cmd = 'DELETE'`,
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it("grants delete to service_role alone, for fixture cleanup only", async () => {
    // The invariant is about user sessions: no authenticated role may delete
    // attendance at any permission level, and there is no delete policy at all.
    // service_role is the server-only secret key, which already bypasses RLS; it
    // holds DELETE only so the non-production seed can clear attendance before
    // deleting learners (migration 0008).
    const result = await db.query<{ grantee: string; can_delete: boolean }>(`
      select grantee,
             bool_and(has_table_privilege(grantee, format('public.%s', tablename), 'DELETE')) as can_delete
      from pg_tables
      cross join (values ('anon'), ('authenticated'), ('service_role')) as roles(grantee)
      where schemaname = 'public'
        and tablename in ('attendance_sessions', 'attendance_records')
      group by grantee
      order by grantee
    `);

    const byRole = new Map(
      result.rows.map((row) => [row.grantee, row.can_delete]),
    );
    expect(byRole.get("anon")).toBe(false);
    expect(byRole.get("authenticated")).toBe(false);
    expect(byRole.get("service_role")).toBe(true);
  });
});

describe("composite foreign keys keep a row in one school", () => {
  it("rejects a session whose class belongs to another school", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.attendance_sessions (school_id, class_id, session_date)
        values ('${SCHOOL_B}', '${CLASS_A}', '${SESSION_DATE}')
      `),
    ).rejects.toThrow();
  });

  it("rejects a session whose subject belongs to another school", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.attendance_sessions (school_id, class_id, subject_id, session_date)
        values ('${SCHOOL_B}', '${CLASS_B}', '${SUBJECT_A}', '${SESSION_DATE}')
      `),
    ).rejects.toThrow();
  });

  it("rejects a record for a learner in another school", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.attendance_records (school_id, session_id, learner_id, status)
        values ('${SCHOOL_B}', 'bbbbbbbb-9999-4000-8000-000000000001',
                '${LEARNER_A1}', 'present')
      `),
    ).rejects.toThrow();
  });

  it("rejects a record aimed at another school's session", async () => {
    await actAsUser(db, ADMIN_B);
    await expect(
      db.query(`
        insert into public.attendance_records (school_id, session_id, learner_id, status)
        values ('${SCHOOL_B}', 'aaaaaaaa-9999-4000-8000-000000000001',
                '${LEARNER_B1}', 'present')
      `),
    ).rejects.toThrow();
  });
});

describe("an administrator sees their whole school", () => {
  it("reads every session in their school and none elsewhere", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query<{ id: string }>(
      `select id from public.attendance_sessions order by id`,
    );
    expect(result.rows.map((row) => row.id)).toEqual([
      "aaaaaaaa-9999-4000-8000-000000000001",
      "aaaaaaaa-9999-4000-8000-000000000002",
    ]);
  });

  it("reads every record in their school and none elsewhere", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query<{ id: string }>(
      `select id from public.attendance_records order by id`,
    );
    expect(result.rows.map((row) => row.id)).toEqual([
      "aaaaaaaa-aaaa-4000-8000-000000000001",
      "aaaaaaaa-aaaa-4000-8000-000000000002",
    ]);
  });

  it("may open a register for any class in their school", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(
        `insert into public.attendance_sessions (school_id, class_id, session_date)
         values ('${SCHOOL_A}', '${CLASS_A}', '2026-10-16')`,
      ),
    ).resolves.toBeDefined();
  });
});

describe("a teacher is confined to their assigned classes", () => {
  it("reads only the sessions for their class", async () => {
    await actAsUser(db, TEACHER_A);
    // Restricted to the seeded rows: other tests in this file legitimately add
    // sessions of their own, and this assertion is about visibility, not counts.
    const result = await db.query<{ id: string }>(
      `select id from public.attendance_sessions
       where id in (
         'aaaaaaaa-9999-4000-8000-000000000001',
         'aaaaaaaa-9999-4000-8000-000000000002',
         'bbbbbbbb-9999-4000-8000-000000000001'
       )
       order by id`,
    );
    expect(result.rows.map((row) => row.id)).toEqual([
      "aaaaaaaa-9999-4000-8000-000000000001",
    ]);
  });

  it("reads only the records for their class", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{ id: string }>(
      `select id from public.attendance_records order by id`,
    );
    expect(result.rows.map((row) => row.id)).toEqual([
      "aaaaaaaa-aaaa-4000-8000-000000000001",
      "aaaaaaaa-aaaa-4000-8000-000000000002",
    ]);
  });

  it("cannot read or touch a session for an unassigned class in their school", async () => {
    await actAsUser(db, TEACHER_A);

    const read = await db.query<{ count: number }>(
      `select count(*)::int as count from public.attendance_sessions
       where id = 'aaaaaaaa-9999-4000-8000-000000000002'`,
    );
    expect(read.rows[0]?.count).toBe(0);

    // An unassigned class in their *own* school is refused by the policy, not
    // merely invisible on read.
    await expect(
      db.query(`
        insert into public.attendance_sessions (school_id, class_id, session_date)
        values ('${SCHOOL_A}', '${CLASS_A_2}', '${SESSION_DATE}')
      `),
    ).rejects.toThrow();

    // An update aimed at it touches no rows, which is the same answer the
    // policy gives as an insert refusal: not theirs to change.
    const hijack = await db.query<{ id: string }>(`
      update public.attendance_sessions set notes = 'hijacked'
      where id = 'aaaaaaaa-9999-4000-8000-000000000002'
      returning id
    `);
    expect(hijack.rows).toHaveLength(0);
  });

  it("shows an unassigned teacher nothing at all", async () => {
    await actAsUser(db, UNASSIGNED_TEACHER_A);

    const sessions = await db.query(
      `select id from public.attendance_sessions`,
    );
    expect(sessions.rows).toHaveLength(0);

    const records = await db.query(`select id from public.attendance_records`);
    expect(records.rows).toHaveLength(0);

    // Holding attendance.record is not enough on its own.
    await expect(
      db.query(`
        insert into public.attendance_sessions (school_id, class_id, session_date)
        values ('${SCHOOL_A}', '${CLASS_A}', '2026-10-16')
      `),
    ).rejects.toThrow();
  });

  it("may open a register for their own class", async () => {
    await actAsUser(db, TEACHER_A);
    await expect(
      db.query(
        `insert into public.attendance_sessions (school_id, class_id, subject_id, session_date)
         values ('${SCHOOL_A}', '${CLASS_A}', '${SUBJECT_A}', '2026-10-15')`,
      ),
    ).resolves.toBeDefined();
  });

  it("loses access as soon as their membership is suspended", async () => {
    await actAsSystem(db);
    await db.query(
      `update public.school_members set status = 'suspended' where id = '${MEMBER_TEACHER_A}'`,
    );

    await actAsUser(db, TEACHER_A);
    const result = await db.query(`select id from public.attendance_sessions`);
    expect(result.rows).toHaveLength(0);

    await actAsSystem(db);
    await db.query(
      `update public.school_members set status = 'active' where id = '${MEMBER_TEACHER_A}'`,
    );
  });
});

describe("the scoped lookup functions", () => {
  it("lists only the caller's assigned classes for a teacher", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{ class_name: string }>(
      `select class_name from public.accessible_classes('${SCHOOL_A}')`,
    );
    expect(result.rows.map((row) => row.class_name)).toEqual(["Primary 1"]);
  });

  it("lists every class in the school for an administrator", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query<{ class_name: string }>(
      `select class_name from public.accessible_classes('${SCHOOL_A}') order by class_name`,
    );
    expect(result.rows.map((row) => row.class_name)).toEqual([
      "Primary 1",
      "Primary 2",
    ]);
  });

  it("returns a roster for the caller's class, with names only", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{
      full_name: string;
      registration_number: string;
    }>(
      `select full_name, registration_number
       from public.class_roster('${SCHOOL_A}', '${CLASS_A}')
       order by full_name`,
    );
    expect(result.rows.map((row) => row.full_name)).toEqual([
      "Ama Bello",
      "Efua Owusu",
      "Kofi Mensah",
    ]);
  });

  it("returns an empty roster for a class the caller cannot access", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query(
      `select * from public.class_roster('${SCHOOL_A}', '${CLASS_A_2}')`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("never returns another school's roster", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query(
      `select * from public.class_roster('${SCHOOL_A}', '${CLASS_B}')`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("offers a teacher only their own subjects in a class", async () => {
    await actAsUser(db, TEACHER_A);
    const result = await db.query<{ subject_name: string }>(
      `select subject_name from public.class_subjects('${SCHOOL_A}', '${CLASS_A}')`,
    );
    expect(result.rows.map((row) => row.subject_name)).toEqual(["Mathematics"]);
  });

  it("offers an administrator every active subject", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query<{ subject_name: string }>(
      `select subject_name from public.class_subjects('${SCHOOL_A}', '${CLASS_A}')
       order by subject_name`,
    );
    expect(result.rows.map((row) => row.subject_name)).toEqual([
      "English",
      "Mathematics",
    ]);
  });

  it("denies these functions to the anonymous role", async () => {
    await actAsAnonymous(db);
    await expect(
      db.query(`select * from public.accessible_classes('${SCHOOL_A}')`),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query(
        `select * from public.class_roster('${SCHOOL_A}', '${CLASS_A}')`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query(
        `select * from public.class_subjects('${SCHOOL_A}', '${CLASS_A}')`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("permissions", () => {
  it("denies anonymous access at the grant, before RLS", async () => {
    await actAsAnonymous(db);
    await expect(
      db.query(`select id from public.attendance_sessions`),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query(`select id from public.attendance_records`),
    ).rejects.toThrow(/permission denied/i);
  });

  it("grants attendance.report to the administrator but not the teacher", async () => {
    const result = await db.query<{ role: string; granted: boolean }>(`
      select r.role,
             has_school_permission('${SCHOOL_A}', 'attendance.report')
               or exists (
                 select 1
                 from public.role_permissions rp
                 where rp.role = r.role and rp.permission = 'attendance.report'
               ) as granted
      from (values ('school_administrator'), ('teacher')) as r(role)
      order by r.role
    `);

    const byRole = new Map(result.rows.map((row) => [row.role, row.granted]));
    expect(byRole.get("school_administrator")).toBe(true);
    expect(byRole.get("teacher")).toBe(false);
  });

  it("keeps learner.read away from the teacher", async () => {
    // The roster is reachable without it; the learner records themselves are not.
    await actAsUser(db, TEACHER_A);
    const result = await db.query(`select id from public.learners`);
    expect(result.rows).toHaveLength(0);
  });
});

describe("auditing", () => {
  it("records an attendance change with its actor", async () => {
    await actAsUser(db, ADMIN_A);
    await db.query(
      `update public.attendance_records set status = 'excused', note = 'sick note'
       where id = 'aaaaaaaa-aaaa-4000-8000-000000000002'`,
    );

    const events = await db.query<{ actor_user_id: string; action: string }>(
      `select actor_user_id, action
       from public.audit_events
       where target_table = 'attendance_records'
         and target_id = 'aaaaaaaa-aaaa-4000-8000-000000000002'
         and action = 'update'
       order by id desc`,
    );
    expect(events.rows[0]?.actor_user_id).toBe(ADMIN_A);
  });

  it("records a session change too", async () => {
    await actAsUser(db, ADMIN_A);
    await db.query(
      `update public.attendance_sessions set notes = 'double period'
       where id = 'aaaaaaaa-9999-4000-8000-000000000001'`,
    );

    const events = await db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_events
       where target_table = 'attendance_sessions'
         and target_id = 'aaaaaaaa-9999-4000-8000-000000000001'`,
    );
    expect(events.rows[0]?.count).toBeGreaterThan(0);
  });
});

describe("grants", () => {
  it("lets the service role bypass RLS for server-side work", async () => {
    await actAsServiceRole(db);
    // All three seeded sessions across both schools, which a session client
    // scoped to school A could not see in full.
    const sessions = await db.query<{ count: number }>(
      `select count(*)::int as count from public.attendance_sessions
       where id in (
         'aaaaaaaa-9999-4000-8000-000000000001',
         'aaaaaaaa-9999-4000-8000-000000000002',
         'bbbbbbbb-9999-4000-8000-000000000001'
       )`,
    );
    expect(sessions.rows[0]?.count).toBe(3);
  });
});
