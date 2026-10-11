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
 * Verifies the enrolment migration's structure and its Row Level Security
 * guarantees against a local PostgreSQL (PGlite). See harness.ts for the
 * limits: this does not replace verification against a real Supabase project.
 */

const SCHOOL_A = "11111111-1111-1111-1111-111111111111";
const SCHOOL_B = "22222222-2222-2222-2222-222222222222";

const ADMIN_A = "aaaaaaaa-0000-4000-8000-000000000001";
const STAFF_A = "aaaaaaaa-0000-4000-8000-000000000002";
const ADMIN_B = "bbbbbbbb-0000-4000-8000-000000000001";
const OUTSIDER = "cccccccc-0000-4000-8000-000000000001";

const LEARNER_A = "aaaaaaaa-1111-4000-8000-000000000001";
const LEARNER_B = "bbbbbbbb-1111-4000-8000-000000000001";
const LEARNER_C = "aaaaaaaa-1111-4000-8000-000000000003";
const LEARNER_E = "aaaaaaaa-1111-4000-8000-000000000005";

const CLASS_A1 = "aaaaaaaa-2222-4000-8000-000000000001";
const CLASS_A2 = "aaaaaaaa-2222-4000-8000-000000000002";
const CLASS_B1 = "bbbbbbbb-2222-4000-8000-000000000001";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();

  await db.exec(`
    insert into public.schools (id, name, code) values
      ('${SCHOOL_A}', 'Alpha Basic School', 'ALPHA01'),
      ('${SCHOOL_B}', 'Brave Basic School', 'BRAVE12');

    insert into auth.users (id) values
      ('${ADMIN_A}'), ('${STAFF_A}'), ('${ADMIN_B}'), ('${OUTSIDER}');

    insert into public.school_members (school_id, user_id, role, status) values
      ('${SCHOOL_A}', '${ADMIN_A}', 'administrator', 'active'),
      ('${SCHOOL_A}', '${STAFF_A}', 'staff', 'active'),
      ('${SCHOOL_B}', '${ADMIN_B}', 'administrator', 'active');

    insert into public.classes (id, school_id, name) values
      ('${CLASS_A1}', '${SCHOOL_A}', 'Primary 1'),
      ('${CLASS_A2}', '${SCHOOL_A}', 'Primary 2'),
      ('${CLASS_B1}', '${SCHOOL_B}', 'Primary 1');

    insert into public.learners (
      id, school_id, registration_number, first_name, last_name, gender,
      date_of_birth, residential_address, guardian_phone, username
    ) values
      ('${LEARNER_A}', '${SCHOOL_A}', 'A-001', 'Ama', 'Owusu', 'female',
       '2015-03-02', '1 Alpha Street', '+233200000001', 'ama.owusu'),
      ('${LEARNER_B}', '${SCHOOL_B}', 'B-001', 'Kofi', 'Mensah', 'male',
       '2014-07-19', '2 Brave Street', '+233200000002', 'kofi.mensah'),
      ('${LEARNER_C}', '${SCHOOL_A}', 'A-002', 'Kojo', 'Asante', 'male',
       '2014-01-11', '3 Alpha Street', '+233200000003', 'kojo.asante');
  `);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await actAsSystem(db);
});

describe("schema structure", () => {
  it("enables RLS on every tenant-owned table", async () => {
    const result = await db.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(`
      select relname, relrowsecurity
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relkind = 'r'
        and relname in (
          'schools', 'school_members', 'role_permissions', 'classes',
          'learners', 'learner_class_placements',
          'learner_portal_credentials', 'audit_events'
        )
      order by relname
    `);

    expect(result.rows).toHaveLength(8);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("defines no client policy for the credential table", async () => {
    const result = await db.query<{ count: number }>(`
      select count(*)::int as count from pg_policies
      where schemaname = 'public' and tablename = 'learner_portal_credentials'
    `);
    expect(result.rows[0]?.count).toBe(0);
  });

  it("defines no delete policy for learners (deactivate, never hard delete)", async () => {
    const result = await db.query<{ count: number }>(`
      select count(*)::int as count from pg_policies
      where schemaname = 'public' and tablename = 'learners' and cmd = 'DELETE'
    `);
    expect(result.rows[0]?.count).toBe(0);
  });
});

describe("school isolation (read)", () => {
  it("shows an administrator only their own school's learners", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query<{ id: string }>(
      `select id from public.learners order by registration_number`,
    );
    expect(result.rows.map((row) => row.id).sort()).toEqual(
      [LEARNER_A, LEARNER_C].sort(),
    );
  });

  it("shows a staff member only their own school's learners", async () => {
    await actAsUser(db, STAFF_A);
    const result = await db.query<{ id: string }>(
      `select id from public.learners`,
    );
    expect(result.rows.map((row) => row.id).sort()).toEqual(
      [LEARNER_A, LEARNER_C].sort(),
    );
  });

  it("shows nothing to an authenticated user with no membership", async () => {
    await actAsUser(db, OUTSIDER);
    const learners = await db.query(`select id from public.learners`);
    const schools = await db.query(`select id from public.schools`);
    expect(learners.rows).toHaveLength(0);
    expect(schools.rows).toHaveLength(0);
  });

  it("denies anonymous reads entirely", async () => {
    await actAsAnonymous(db);
    await expect(db.query(`select id from public.learners`)).rejects.toThrow();
  });
});

describe("global permission catalogue", () => {
  it("grants the administrator the full enrolment permission set", async () => {
    await actAsUser(db, ADMIN_A);
    const result = await db.query<{ permission: string }>(
      `select permission from public.role_permissions where role = 'administrator'`,
    );
    const permissions = result.rows.map((row) => row.permission);
    expect(permissions).toEqual(
      expect.arrayContaining([
        "member.manage",
        "class.manage",
        "learner.create",
        "learner.update",
        "learner.placement.manage",
        "learner.portal.manage",
        "audit.read",
      ]),
    );
  });

  it("gives staff create and view only, never membership or audit rights", async () => {
    await actAsUser(db, STAFF_A);
    const result = await db.query<{ permission: string }>(
      `select permission from public.role_permissions where role = 'staff'`,
    );
    const permissions = result.rows.map((row) => row.permission).sort();
    expect(permissions).toEqual([
      "class.read",
      "learner.create",
      "learner.read",
    ]);
  });
});

describe("school isolation (write)", () => {
  it("refuses an insert that names another school's id", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(
        `insert into public.learners (
           school_id, registration_number, first_name, last_name, gender,
           date_of_birth, residential_address, guardian_phone, username
         ) values (
           '${SCHOOL_B}', 'X-001', 'Eve', 'Adjei', 'female', '2015-01-01',
           'Elsewhere', '+233200000009', 'eve.adjei'
         )`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("refuses a staff member inserting a school membership", async () => {
    await actAsUser(db, STAFF_A);
    await expect(
      db.query(
        `insert into public.school_members (school_id, user_id, role, status)
         values ('${SCHOOL_A}', '${OUTSIDER}', 'staff', 'active')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("allows an administrator to add a membership in their own school", async () => {
    await actAsUser(db, ADMIN_A);
    await db.query(
      `insert into public.school_members (school_id, user_id, role, status)
       values ('${SCHOOL_A}', '${OUTSIDER}', 'staff', 'active')`,
    );
    await actAsSystem(db);
    await db.query(
      `delete from public.school_members where user_id = '${OUTSIDER}'`,
    );
  });
});

describe("cross-school integrity", () => {
  it("prevents placing a learner into another school's class", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(
        `insert into public.learner_class_placements (school_id, learner_id, class_id)
         values ('${SCHOOL_A}', '${LEARNER_A}', '${CLASS_B1}')`,
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });
});

describe("deactivate, do not delete", () => {
  it("refuses to delete a learner, leaving the record intact", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(
        `delete from public.learners where id = '${LEARNER_C}' returning id`,
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);

    await actAsSystem(db);
    const stillThere = await db.query(
      `select id from public.learners where id = '${LEARNER_C}'`,
    );
    expect(stillThere.rows).toHaveLength(1);
  });
});

describe("one current placement per learner", () => {
  it("rejects a second open placement, then accepts one after the first ends", async () => {
    await actAsSystem(db);

    await db.query(
      `insert into public.learner_class_placements (school_id, learner_id, class_id)
       values ('${SCHOOL_A}', '${LEARNER_C}', '${CLASS_A1}')`,
    );

    await expect(
      db.query(
        `insert into public.learner_class_placements (school_id, learner_id, class_id)
         values ('${SCHOOL_A}', '${LEARNER_C}', '${CLASS_A2}')`,
      ),
    ).rejects.toThrow(/duplicate key value/i);

    await db.query(
      `update public.learner_class_placements
         set ended_at = now()
       where learner_id = '${LEARNER_C}' and ended_at is null`,
    );

    await db.query(
      `insert into public.learner_class_placements (school_id, learner_id, class_id)
       values ('${SCHOOL_A}', '${LEARNER_C}', '${CLASS_A2}')`,
    );

    const open = await db.query(
      `select id from public.learner_class_placements
        where learner_id = '${LEARNER_C}' and ended_at is null`,
    );
    expect(open.rows).toHaveLength(1);
  });
});

describe("audit trail", () => {
  it("records who enrolled a learner, without storing personal values", async () => {
    await actAsUser(db, ADMIN_A);

    await db.query(
      `insert into public.learners (
         id, school_id, registration_number, first_name, last_name, gender,
         date_of_birth, residential_address, guardian_phone, username
       ) values (
         '${LEARNER_E}', '${SCHOOL_A}', 'E-001', 'Esi', 'Yaw', 'female',
         '2016-05-05', '5 Alpha Street', '+233200000005', 'esi.yaw'
       )`,
    );

    await db.query(
      `update public.learners set first_name = 'Akosua' where id = '${LEARNER_E}'`,
    );

    const events = await db.query<{
      action: string;
      actor_user_id: string;
      target_table: string;
      details: { changed_columns?: string[] };
    }>(
      `select action, actor_user_id, target_table, details
         from public.audit_events
        where target_table = 'learners' and target_id = '${LEARNER_E}'
        order by id`,
    );

    expect(events.rows.map((row) => row.action)).toEqual(["insert", "update"]);
    expect(events.rows.every((row) => row.actor_user_id === ADMIN_A)).toBe(
      true,
    );

    const updateEvent = events.rows[1];
    expect(updateEvent?.details.changed_columns).toContain("first_name");
    // The audit detail must not duplicate the changed personal value.
    expect(JSON.stringify(updateEvent?.details)).not.toContain("Akosua");
  });

  it("hides audit history from staff, who lack the audit permission", async () => {
    await actAsUser(db, STAFF_A);
    const events = await db.query(`select id from public.audit_events`);
    expect(events.rows).toHaveLength(0);
  });

  it("prevents an administrator from writing or erasing audit history", async () => {
    await actAsUser(db, ADMIN_A);

    await expect(
      db.query(
        `insert into public.audit_events (school_id, action, target_table, target_id)
         values ('${SCHOOL_A}', 'tamper', 'learners', '${LEARNER_A}')`,
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);

    await expect(
      db.query(
        `delete from public.audit_events where target_id = '${LEARNER_E}' returning id`,
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});

describe("portal credentials are server-only", () => {
  it("denies authenticated reads", async () => {
    await actAsUser(db, ADMIN_A);
    await expect(
      db.query(`select id from public.learner_portal_credentials`),
    ).rejects.toThrow(/permission denied/i);
  });

  it("is writable and readable through the server-only role", async () => {
    await actAsServiceRole(db);
    await db.query(
      `insert into public.learner_portal_credentials (
         school_id, learner_id, purpose, credential_hash, expires_at
       ) values (
         '${SCHOOL_A}', '${LEARNER_A}', 'activation',
         repeat('ab', 32), now() + interval '72 hours'
       )`,
    );
    const result = await db.query(
      `select id from public.learner_portal_credentials where learner_id = '${LEARNER_A}'`,
    );
    expect(result.rows).toHaveLength(1);
  });
});

describe("membership status", () => {
  it("removes access immediately when a membership is suspended", async () => {
    await actAsSystem(db);
    await db.query(
      `update public.school_members set status = 'suspended'
        where user_id = '${STAFF_A}'`,
    );

    await actAsUser(db, STAFF_A);
    const learners = await db.query(`select id from public.learners`);
    expect(learners.rows).toHaveLength(0);

    await actAsSystem(db);
    await db.query(
      `update public.school_members set status = 'active'
        where user_id = '${STAFF_A}'`,
    );
  });
});
