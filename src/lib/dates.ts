/**
 * Calendar-date helpers shared by the request parsers.
 *
 * Pure and isomorphic. Dates cross the wire as `YYYY-MM-DD` because that is what
 * PostgreSQL `date` accepts, so no timezone conversion happens in the browser
 * and a date typed in Ghana means the same calendar day it means on the server.
 *
 * The parsers never read the clock themselves: the caller injects "today"
 * (`utcToday()`), which keeps them deterministic and unit-testable
 * (docs/AGENTS.md 13).
 */

/** The wire format for a PostgreSQL `date`. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is `YYYY-MM-DD` and names a real calendar date. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** Renders a `Date` as `YYYY-MM-DD` in UTC. */
export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Today's calendar date in UTC.
 *
 * Deliberately UTC and not a per-school timezone: the platform has no
 * configurable school timezone yet, and Ghana is UTC+0, so the two agree today.
 * Recorded as a known limitation in docs/DECISIONS.md D-030 — a school west of
 * UTC could see a day boundary that differs from its local one, and fixing it
 * needs a school timezone setting, which is a separate decision.
 */
export function utcToday(): string {
  return formatUtcDate(new Date());
}

/** Whole days from `from` to `to`; negative when `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
