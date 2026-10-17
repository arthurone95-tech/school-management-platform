import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_MAX_RECORDS,
  ATTENDANCE_MAX_REPORT_DAYS,
  ATTENDANCE_NOTE_MAX_LENGTH,
  ATTENDANCE_STATUSES,
  parseRegisterSubmitInput,
  parseReportQuery,
  parseSessionCreateInput,
  parseSessionListQuery,
} from "./requests";

const TODAY = "2026-10-17";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const SUBJECT_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const LEARNER_A = "44444444-4444-4444-8444-444444444444";
const LEARNER_B = "55555555-5555-4555-8555-555555555555";

function query(params: Record<string, string>) {
  return new URLSearchParams(params);
}

describe("parseSessionCreateInput", () => {
  it("accepts a class, date and optional subject", () => {
    const result = parseSessionCreateInput(
      { classId: CLASS_ID, sessionDate: TODAY, subjectId: SUBJECT_ID },
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        classId: CLASS_ID,
        subjectId: SUBJECT_ID,
        sessionDate: TODAY,
        notes: null,
      },
    });
  });

  it("treats an absent or blank subject and notes as null", () => {
    const result = parseSessionCreateInput(
      { classId: CLASS_ID, sessionDate: TODAY, subjectId: "  ", notes: "" },
      TODAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subjectId).toBeNull();
      expect(result.value.notes).toBeNull();
    }
  });

  it("trims a note", () => {
    const result = parseSessionCreateInput(
      { classId: CLASS_ID, sessionDate: TODAY, notes: "  Physics period 1  " },
      TODAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notes).toBe("Physics period 1");
    }
  });

  it("rejects a missing or malformed class", () => {
    expect(parseSessionCreateInput({ sessionDate: TODAY }, TODAY)).toEqual({
      ok: false,
      message: "Choose a class.",
    });
    expect(
      parseSessionCreateInput({ classId: "nope", sessionDate: TODAY }, TODAY)
        .ok,
    ).toBe(false);
    expect(
      parseSessionCreateInput(
        { classId: CLASS_ID, sessionDate: TODAY, subjectId: "nope" },
        TODAY,
      ).ok,
    ).toBe(false);
  });

  it("rejects a missing, malformed or impossible date", () => {
    expect(parseSessionCreateInput({ classId: CLASS_ID }, TODAY).ok).toBe(
      false,
    );
    expect(
      parseSessionCreateInput(
        { classId: CLASS_ID, sessionDate: "17/10/2026" },
        TODAY,
      ).ok,
    ).toBe(false);
    // 2026-02-30 does not exist.
    expect(
      parseSessionCreateInput(
        { classId: CLASS_ID, sessionDate: "2026-02-30" },
        TODAY,
      ).ok,
    ).toBe(false);
  });

  it("refuses a future date", () => {
    const result = parseSessionCreateInput(
      { classId: CLASS_ID, sessionDate: "2026-10-18" },
      TODAY,
    );
    expect(result).toEqual({
      ok: false,
      message: "Attendance cannot be recorded for a future date.",
    });
  });

  it("accepts today and any earlier date", () => {
    expect(
      parseSessionCreateInput({ classId: CLASS_ID, sessionDate: TODAY }, TODAY)
        .ok,
    ).toBe(true);
    expect(
      parseSessionCreateInput(
        { classId: CLASS_ID, sessionDate: "2026-01-05" },
        TODAY,
      ).ok,
    ).toBe(true);
  });

  it("rejects an over-long note", () => {
    const result = parseSessionCreateInput(
      {
        classId: CLASS_ID,
        sessionDate: TODAY,
        notes: "x".repeat(ATTENDANCE_NOTE_MAX_LENGTH + 1),
      },
      TODAY,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseSessionCreateInput(null, TODAY).ok).toBe(false);
    expect(parseSessionCreateInput("x", TODAY).ok).toBe(false);
    expect(parseSessionCreateInput([1], TODAY).ok).toBe(false);
  });
});

describe("parseSessionListQuery", () => {
  it("defaults an absent date to today and an absent class to all", () => {
    expect(parseSessionListQuery(query({}), TODAY)).toEqual({
      ok: true,
      value: { sessionDate: TODAY, classId: null },
    });
  });

  it("reads a date and class", () => {
    expect(
      parseSessionListQuery(
        query({ date: "2026-10-01", classId: CLASS_ID }),
        TODAY,
      ),
    ).toEqual({
      ok: true,
      value: { sessionDate: "2026-10-01", classId: CLASS_ID },
    });
  });

  it("accepts a future date filter, unlike a session date", () => {
    expect(parseSessionListQuery(query({ date: "2026-11-30" }), TODAY).ok).toBe(
      true,
    );
  });

  it("rejects a malformed date or class", () => {
    expect(parseSessionListQuery(query({ date: "01-10-2026" }), TODAY).ok).toBe(
      false,
    );
    expect(parseSessionListQuery(query({ classId: "nope" }), TODAY).ok).toBe(
      false,
    );
  });
});

describe("parseRegisterSubmitInput", () => {
  function body(entries: unknown) {
    return { sessionId: SESSION_ID, entries };
  }

  it("accepts a full register", () => {
    const result = parseRegisterSubmitInput(
      body([
        { learnerId: LEARNER_A, status: "present" },
        { learnerId: LEARNER_B, status: "absent", note: "sick note seen" },
      ]),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: SESSION_ID,
        entries: [
          { learnerId: LEARNER_A, status: "present", note: null },
          { learnerId: LEARNER_B, status: "absent", note: "sick note seen" },
        ],
      },
    });
  });

  it("accepts every permitted status", () => {
    for (const status of ATTENDANCE_STATUSES) {
      const result = parseRegisterSubmitInput(
        body([{ learnerId: LEARNER_A, status }]),
      );
      expect(result.ok).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(
      parseRegisterSubmitInput(
        body([{ learnerId: LEARNER_A, status: "maybe" }]),
      ).ok,
    ).toBe(false);
  });

  it("rejects a repeated learner rather than silently collapsing it", () => {
    const result = parseRegisterSubmitInput(
      body([
        { learnerId: LEARNER_A, status: "present" },
        { learnerId: LEARNER_A, status: "absent" },
      ]),
    );
    expect(result).toEqual({
      ok: false,
      message: "Each learner can appear only once in a register.",
    });
  });

  it("rejects an empty or oversized register", () => {
    expect(parseRegisterSubmitInput(body([])).ok).toBe(false);
    const oversized = Array.from(
      { length: ATTENDANCE_MAX_RECORDS + 1 },
      (_unused, index) => ({
        learnerId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        status: "present",
      }),
    );
    expect(parseRegisterSubmitInput(body(oversized)).ok).toBe(false);
  });

  it("rejects a non-array entries field and a malformed entry", () => {
    expect(parseRegisterSubmitInput({ sessionId: SESSION_ID }).ok).toBe(false);
    expect(
      parseRegisterSubmitInput(body([{ learnerId: "nope", status: "present" }]))
        .ok,
    ).toBe(false);
    expect(parseRegisterSubmitInput(body(["x"])).ok).toBe(false);
  });

  it("rejects a malformed session id and a malformed note", () => {
    expect(
      parseRegisterSubmitInput({ sessionId: "nope", entries: [] }).ok,
    ).toBe(false);
    expect(
      parseRegisterSubmitInput(
        body([
          {
            learnerId: LEARNER_A,
            status: "present",
            note: "x".repeat(ATTENDANCE_NOTE_MAX_LENGTH + 1),
          },
        ]),
      ).ok,
    ).toBe(false);
  });
});

describe("parseReportQuery", () => {
  it("requires a class", () => {
    expect(parseReportQuery(query({}), TODAY)).toEqual({
      ok: false,
      message: "Choose a class.",
    });
    expect(parseReportQuery(query({ classId: "nope" }), TODAY).ok).toBe(false);
  });

  it("defaults the window to today", () => {
    expect(parseReportQuery(query({ classId: CLASS_ID }), TODAY)).toEqual({
      ok: true,
      value: { classId: CLASS_ID, from: TODAY, to: TODAY },
    });
  });

  it("reads a window and defaults `to` to `from`", () => {
    expect(
      parseReportQuery(query({ classId: CLASS_ID, from: "2026-09-01" }), TODAY),
    ).toEqual({
      ok: true,
      value: { classId: CLASS_ID, from: "2026-09-01", to: "2026-09-01" },
    });
  });

  it("rejects an inverted window", () => {
    expect(
      parseReportQuery(
        query({ classId: CLASS_ID, from: "2026-10-10", to: "2026-10-01" }),
        TODAY,
      ).ok,
    ).toBe(false);
  });

  it("bounds the window so a report cannot span unbounded history", () => {
    expect(
      parseReportQuery(
        query({
          classId: CLASS_ID,
          from: "2020-01-01",
          to: "2026-10-01",
        }),
        TODAY,
      ).ok,
    ).toBe(false);
    // The maximum accepted window is inclusive of the bound.
    expect(
      parseReportQuery(
        query({
          classId: CLASS_ID,
          from: "2025-10-18",
          to: "2026-10-17",
        }),
        TODAY,
      ).ok,
    ).toBe(true);
    expect(ATTENDANCE_MAX_REPORT_DAYS).toBe(366);
  });

  it("rejects a malformed date", () => {
    expect(
      parseReportQuery(query({ classId: CLASS_ID, from: "01-09-2026" }), TODAY)
        .ok,
    ).toBe(false);
  });
});
