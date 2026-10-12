import { describe, expect, it } from "vitest";

import { classifySignIn, type SchoolMembershipRow } from "./membership";

function row(overrides: Partial<SchoolMembershipRow>): SchoolMembershipRow {
  return {
    id: "member-1",
    schoolId: "school-1",
    role: "school_administrator",
    status: "active",
    ...overrides,
  };
}

describe("classifySignIn", () => {
  it("returns not-staff for an account with no membership", () => {
    expect(classifySignIn([])).toEqual({ kind: "not-staff" });
  });

  it("returns not-staff for a non-staff role (for example a student)", () => {
    const rows = [row({ role: "student", status: "active" })];
    expect(classifySignIn(rows)).toEqual({ kind: "not-staff" });
  });

  it("returns active for an active school administrator", () => {
    const rows = [row({ role: "school_administrator", status: "active" })];
    expect(classifySignIn(rows)).toEqual({
      kind: "active",
      membership: rows[0],
    });
  });

  it("returns invited for a single invited teacher membership", () => {
    const rows = [row({ role: "teacher", status: "invited" })];
    expect(classifySignIn(rows)).toEqual({
      kind: "invited",
      membership: rows[0],
    });
  });

  it("denies a suspended membership", () => {
    expect(classifySignIn([row({ status: "suspended" })])).toEqual({
      kind: "denied",
    });
  });

  it("denies a revoked membership", () => {
    expect(classifySignIn([row({ status: "revoked" })])).toEqual({
      kind: "denied",
    });
  });

  it("denies an anomalous multi-membership state rather than guessing", () => {
    const rows = [
      row({ id: "m1", schoolId: "school-1", status: "active" }),
      row({ id: "m2", schoolId: "school-2", status: "active" }),
    ];
    expect(classifySignIn(rows)).toEqual({ kind: "denied" });
  });

  it("denies when an invited membership shares the user with a revoked one", () => {
    const rows = [
      row({ id: "m1", schoolId: "school-1", status: "invited" }),
      row({ id: "m2", schoolId: "school-2", status: "revoked" }),
    ];
    expect(classifySignIn(rows)).toEqual({ kind: "denied" });
  });
});
