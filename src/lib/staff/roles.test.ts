import { describe, expect, it } from "vitest";

import { STAFF_ROLES } from "./requests";
import { roleLabel, STAFF_ROLE_OPTIONS } from "./roles";

describe("staff role labels", () => {
  it("offers exactly the approved staff roles, in catalogue order", () => {
    expect(STAFF_ROLE_OPTIONS.map((option) => option.value)).toEqual([
      ...STAFF_ROLES,
    ]);
  });

  it("labels each approved role", () => {
    expect(roleLabel("school_administrator")).toBe("School administrator");
    expect(roleLabel("teacher")).toBe("Teacher");
  });

  it("falls back to the raw value for an unknown role", () => {
    expect(roleLabel("student")).toBe("student");
    expect(roleLabel("")).toBe("");
  });
});
