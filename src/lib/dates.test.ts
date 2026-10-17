import { describe, expect, it } from "vitest";

import { daysBetween, formatUtcDate, isIsoDate, utcToday } from "./dates";

describe("isIsoDate", () => {
  it("accepts a real calendar date", () => {
    expect(isIsoDate("2026-10-17")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });

  it("rejects the wrong shape, an impossible date, and junk", () => {
    expect(isIsoDate("17/10/2026")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    // 2026 is not a leap year.
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate("not a date")).toBe(false);
  });
});

describe("formatUtcDate", () => {
  it("renders a Date as YYYY-MM-DD in UTC", () => {
    expect(formatUtcDate(new Date("2026-10-17T23:30:00Z"))).toBe("2026-10-17");
    expect(formatUtcDate(new Date("2026-10-17T00:30:00Z"))).toBe("2026-10-17");
  });
});

describe("utcToday", () => {
  it("is a valid ISO date within a plausible range", () => {
    const today = utcToday();
    expect(isIsoDate(today)).toBe(true);
    expect(today >= "2026-01-01").toBe(true);
  });
});

describe("daysBetween", () => {
  it("counts whole days forwards", () => {
    expect(daysBetween("2026-10-17", "2026-10-17")).toBe(0);
    expect(daysBetween("2026-10-17", "2026-10-18")).toBe(1);
    expect(daysBetween("2026-10-17", "2026-11-17")).toBe(31);
  });

  it("is negative when the end precedes the start", () => {
    expect(daysBetween("2026-10-18", "2026-10-17")).toBe(-1);
  });

  it("crosses a leap day correctly", () => {
    // 2024-02-29 exists, so this span is 366 days.
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
  });
});
