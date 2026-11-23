import { describe, expect, it } from "vitest";

import {
  attendanceStatusLabel,
  auditActionLabel,
  auditTableLabel,
  formatCalendarDate,
  formatDateTime,
  formatMeasure,
  portalStateLabel,
} from "./display";

describe("formatDateTime", () => {
  it("formats an instant in UTC", () => {
    expect(formatDateTime("2026-11-22T09:35:00.000Z")).toBe(
      "22 Nov 2026, 09:35 UTC",
    );
  });

  it("uses the fallback for missing or invalid values", () => {
    expect(formatDateTime(null)).toBe("Not recorded");
    expect(formatDateTime("not-a-date")).toBe("Not recorded");
  });
});

describe("formatCalendarDate", () => {
  it("formats a date without shifting the calendar day", () => {
    expect(formatCalendarDate("2015-04-09")).toBe("09 Apr 2015");
  });
});

describe("formatMeasure", () => {
  it("rounds to two decimals and drops trailing zeros", () => {
    expect(formatMeasure(66.666)).toBe("66.67");
    expect(formatMeasure(50)).toBe("50");
  });
});

describe("domain labels", () => {
  it("maps portal and attendance states to readable labels", () => {
    expect(portalStateLabel("activation_pending")).toBe("Activation pending");
    expect(portalStateLabel("something_new")).toBe("something_new");
    expect(attendanceStatusLabel("excused")).toBe("Authorized absence");
  });

  it("maps audit actions and tables to readable labels", () => {
    expect(auditActionLabel("insert")).toBe("Created");
    expect(auditTableLabel("learner_class_placements")).toBe("Class placement");
    expect(auditTableLabel("unknown_table")).toBe("unknown_table");
  });
});
