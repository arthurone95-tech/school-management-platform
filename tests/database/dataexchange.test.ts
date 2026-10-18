import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  actAsAnonymous,
  actAsSystem,
  actAsUser,
  createTestDatabase,
} from "./harness";

/**
 * Verifies migration `20261018000010_phase5_data_exchange` (D-032).
 *
 * This slice adds no tables on purpose: a bulk enrolment is the same two inserts
 * the single-student flow already performs, so the guarantees that matter are the
 * *existing* ones. What is new is the export audit event and the three
 * permissions, and those are what this file checks — in particular that an export
 * is written by the database with the verified caller as its actor, and that a
 * caller cannot supply somebody else's identity.
 */

const SCHOOL_A = "11111111-1111-4111-8111-111111111111";
const SCHOOL_B = "22222222-2222-4222-8222-222222222222";

const ADMIN_A = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_A = "aaaaaaaa-0000-4000-8000-000000000002";
const ADMIN_B = "bbbbbbbb-0000-4000-8000-000000000001";

const MEMBER_ADMIN_A = "aaaaaaaa-3333-4000-8000-000000000001";
const MEMBER_TEACHER_A = "aaaaaaaa-3333-4000-8000-000000000002";
const MEMBER_ADMIN_B = "bbbbbbbb-3333-4000-8000-000000000001";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();

  await db.exec(`
    insert into public.schools (id, name, code) values
      ('${SCHOOL_A}', 'Alpha Basic School', 'ALPHA01'),
      ('${SCHOOL_B}', 'Brave Basic School', 'BRAVE12');

    insert into auth.users (id) values ('${ADMIN_A}'), ('${TEACHER_A}'), ('${ADMIN_B}');

    -- Distinct users per school, so a cross-school write is genuinely refused
    -- rather than permitted by an accidental second membership.
    insert into public.school_members (id, school_id, user_id, role, status) values
      ('${MEMBER_ADMIN_A}', '${SCHOOL_A}', '${ADMIN_A}', 'school_administrator', 'active'),
      ('${MEMBER_TEACHER_A}', '${SCHOOL_A}', '${TEACHER_A}', 'teacher', 'active'),
      ('${MEMBER_ADMIN_B}', '${SCHOOL_B}', '${ADMIN_B}', 'school_administrator', 'active');
  `);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await actAsSystem(db);
  await db.exec(`delete from public.audit_events`);
});

describe("export auditing", () => {
  it("writes the event with the verified caller as the actor", async () => {
    await actAsUser(db, ADMIN_A);
    await db.query(`select public.record_data_export('learners', 12)`);

    const events = await db.query<{
      action: string;
      target_table: string;
      target_id: string;
      actor_user_id: string;
      details: { kind: string; rows: number };
    }>(
      `select action, target_table, target_id, actor_user_id, details
       from public.audit_events where action = 'export'`,
    );

    expect(events.rows).toHaveLength(1);
    const event = events.rows[0];
    expect(event?.actor_user_id).toBe(ADMIN_A);
    expect(event?.target_table).toBe("learners");
    expect(event?.target_id).toBe("learners");
    expect(event?.details).toMatchObject({ kind: "learners", rows: 12 });
  });

  it("records a class sheet export separately from a learner export", async () => {
    await actAsUser(db, ADMIN_A);
    await db.query(`select public.record_data_export('class_sheet', 3)`);

    const events = await db.query<{ target_id: string }>(
      `select target_id from public.audit_events where action = 'export'`,
    );
    expect(events.rows.map((row) => row.target_id)).toEqual(["class_sheet"]);
  });

  it("refuses an event with no kind, rather than storing an unnamed one", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`select public.record_data_export('', 1)`),
    ).rejects.toThrow(/export kind is required/);
  });

  it("cannot be called by an anonymous caller", async () => {
    await actAsAnonymous(db);
    await expect(
      db.query(`select public.record_data_export('learners', 5)`),
    ).rejects.toThrow(/permission denied/i);
  });

  it("attributes the event to the session, not to a supplied value", async () => {
    // The function takes no actor parameter at all, which is the guarantee: there
    // is no argument a caller could use to blame somebody else.
    await actAsUser(db, TEACHER_A);
    await db.query(`select public.record_data_export('learners', 1)`);

    // Read it back as an administrator, because `audit_events` select requires
    // `audit.read` and a teacher holds none: the teacher can *cause* an audit
    // event but cannot read the audit trail. Reading it as the admin also proves
    // the row was attributed to the teacher's session rather than to whoever ran
    // the query.
    await actAsUser(db, ADMIN_A);
    const events = await db.query<{ actor_user_id: string }>(
      `select actor_user_id from public.audit_events where action = 'export'`,
    );
    expect(events.rows[0]?.actor_user_id).toBe(TEACHER_A);
  });
});

describe("permissions", () => {
  it("grants the three data-exchange permissions to the administrator only", async () => {
    const result = await db.query<{ role: string; permission: string }>(
      `select role, permission from public.role_permissions
       where permission in ('learner.import', 'learner.export', 'report.export')
       order by role, permission`,
    );
    expect(result.rows).toEqual([
      { role: "school_administrator", permission: "learner.export" },
      { role: "school_administrator", permission: "learner.import" },
      { role: "school_administrator", permission: "report.export" },
    ]);
  });

  it("gives the teacher no data-exchange permission at all", async () => {
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from public.role_permissions
       where role = 'teacher'
         and permission in ('learner.import', 'learner.export', 'report.export')`,
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it("reports the permission through has_school_permission", async () => {
    await actAsUser(db, ADMIN_A);
    const granted = await db.query<{ allowed: boolean }>(
      `select public.has_school_permission('${SCHOOL_A}', 'learner.export') as allowed`,
    );
    expect(granted.rows[0]?.allowed).toBe(true);

    await actAsUser(db, TEACHER_A);
    const denied = await db.query<{ allowed: boolean }>(
      `select public.has_school_permission('${SCHOOL_A}', 'learner.export') as allowed`,
    );
    expect(denied.rows[0]?.allowed).toBe(false);
  });

  it("fails closed: an export by someone with no membership cannot be audited, so it cannot happen", async () => {
    // `school_id` is resolved from the caller's own membership, and
    // `audit_events.school_id` is NOT NULL. A caller who is not an active member
    // of a school therefore cannot record an export at all, rather than recording
    // one that belongs to nobody.
    await db.exec(
      `delete from public.school_members where id = '${MEMBER_TEACHER_A}'`,
    );
    await actAsUser(db, TEACHER_A);
    await expect(
      db.query(`select public.record_data_export('learners', 1)`),
    ).rejects.toThrow(/school_id/);
  });
});

describe("this slice adds no tables", () => {
  it("leaves the learner tables governed by their existing policies", async () => {
    // A bulk import is the same two inserts the single-student flow performs, so
    // the guards that already exist must still be the ones that apply.
    await actAsUser(db, TEACHER_A);
    await expect(
      db.query(`
        insert into public.learners (
          school_id, registration_number, first_name, last_name, gender,
          date_of_birth, residential_address, guardian_phone, username
        )
        values (
          '${SCHOOL_A}', 'T-1', 'Test', 'Learner', 'other',
          '2016-01-01', 'Plot 1', '0240000000', 'testlearner'
        )
      `),
    ).rejects.toThrow();
  });

  it("still refuses a cross-school registration number", async () => {
    await actAsUser(db, ADMIN_A);
    await db.query(`
      insert into public.classes (id, school_id, name)
      values ('aaaaaaaa-7777-4000-8000-000000000001', '${SCHOOL_A}', 'Primary 1')
    `);
    await db.query(`
      insert into public.learners (
        school_id, registration_number, first_name, last_name, gender,
        date_of_birth, residential_address, guardian_phone, username
      )
      values (
        '${SCHOOL_A}', 'A-1', 'Ama', 'Bello', 'female',
        '2016-05-04', 'Plot 3', '0240000001', 'ama'
      )
    `);
    await expect(
      db.query(`
        insert into public.learners (
          school_id, registration_number, first_name, last_name, gender,
          date_of_birth, residential_address, guardian_phone, username
        )
        values (
          '${SCHOOL_B}', 'A-1', 'Kofi', 'Mensah', 'male',
          '2016-07-19', 'Plot 5', '0240000002', 'kofi'
        )
      `),
    ).rejects.toThrow();
  });
});
