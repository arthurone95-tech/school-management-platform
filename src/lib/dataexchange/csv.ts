/**
 * CSV parsing and serialization for bulk import and export (D-032).
 *
 * Pure and isomorphic so both directions are unit-tested without a database.
 *
 * CSV is the format a school actually has: most arrive with a spreadsheet from a
 * previous system or from a head teacher's records. Two properties matter more
 * than elegance here:
 *
 *   * **Quoting is handled correctly**, because real data contains commas
 *     ("Bello, Ama"), quotes (`O"Brien`), and newlines inside an address field.
 *     A naive split corrupts those silently, which would mean importing wrong
 *     personal data about a child.
 *   * **A spreadsheet formula prefix is neutralized on export.** A value starting
 *     with `=`, `+`, `-` or `@` is written with a leading apostrophe, because a
 *     cell beginning `=` is executed as a formula when the file is opened in
 *     Excel or LibreOffice. Child data is untrusted input from a school's own
 *     records, and this is a well-known CSV-injection path.
 *
 * Neither direction is a security boundary: the import rows are validated again
 * by the enrolment parser and enforced again by the database, and the export is
 * gated by a permission and written by trusted server code.
 */

/** Refuses a spreadsheet formula when a cell's text is written out. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export const CSV_MAX_COLUMNS = 40;
export const CSV_MAX_ROWS = 5000;

export interface CsvTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses CSV text into a header and rows of raw strings. */
export function parseCsv(text: string): ParseResult<CsvTable> {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let index = 0;
  let line = 1;
  let quoteStartLine = 1;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    // Skip a trailing blank line rather than recording an empty row.
    if (record.length === 1 && record[0] === "") {
      record = [];
      return;
    }
    records.push(record);
    record = [];
  };

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      if (char === "\n") {
        line += 1;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      // A quote only opens a quoted field at the start of one; elsewhere it is
      // literal text, which keeps `12" pipe` intact.
      if (field.length === 0) {
        inQuotes = true;
        quoteStartLine = line;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === ",") {
      pushField();
      index += 1;
      continue;
    }

    if (char === "\r") {
      index += 1;
      continue;
    }

    if (char === "\n") {
      pushRecord();
      line += 1;
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (inQuotes) {
    // Report where the unterminated value *started*, not where the file ran out:
    // an unclosed quote swallows everything after it, so the opening line is the
    // one the user has to look at.
    return {
      ok: false,
      message: `A quoted value starting on line ${quoteStartLine} is never closed. Check that line for a missing " quote.`,
    };
  }

  if (record.length > 0 || field.length > 0) {
    pushRecord();
  }

  if (records.length === 0) {
    return { ok: false, message: "The file is empty." };
  }
  if (records.length - 1 > CSV_MAX_ROWS) {
    return {
      ok: false,
      message: `The file has more than ${CSV_MAX_ROWS} rows. Split it and import in parts.`,
    };
  }

  const header = records[0].map((name) => name.trim());
  if (header.length > CSV_MAX_COLUMNS) {
    return {
      ok: false,
      message: `The file has more than ${CSV_MAX_COLUMNS} columns.`,
    };
  }
  if (header.every((name) => name.length === 0)) {
    return { ok: false, message: "The file has no header row." };
  }

  const rows = records.slice(1);
  const tooWide = rows.findIndex((row) => row.length > header.length);
  if (tooWide !== -1) {
    return {
      ok: false,
      message: `Row ${tooWide + 2} has more values than the header has columns.`,
    };
  }

  return { ok: true, value: { header, rows } };
}

/** Escapes one value for writing into CSV. */
export function escapeCsvValue(value: string): string {
  const neutralized = neutralizeFormula(value);
  if (
    neutralized.includes(",") ||
    neutralized.includes('"') ||
    neutralized.includes("\n") ||
    neutralized.includes("\r")
  ) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

/**
 * Defuses a leading spreadsheet formula character.
 *
 * Only applied when the cell is *text*, which is what a child's name or address
 * is. A numeric-looking value such as `-5` is therefore also prefixed, which is
 * harmless: the value is still visible and readable to whoever opens the file.
 */
export function neutralizeFormula(value: string): string {
  if (value.length === 0) {
    return value;
  }
  if (FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return `'${value}`;
  }
  return value;
}

/** Serializes a table to CSV text with a trailing newline. */
export function toCsv(table: CsvTable): string {
  const lines = [
    table.header.map(escapeCsvValue).join(","),
    ...table.rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export interface ColumnMapping {
  readonly header: readonly string[];
  readonly index: Record<string, number>;
  readonly missing: readonly string[];
  readonly unknown: readonly string[];
}

export type MapResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/**
 * Maps a header row onto required and optional columns.
 *
 * Matching is case-insensitive and ignores spaces and underscores, so a
 * spreadsheet column called `Registration Number`, `registration_number` or
 * `REGISTRATIONNUMBER` all work — real files are inconsistent.
 *
 * A missing **required** column is refused outright, because a bulk import that
 * silently skipped the registration number would create unusable records. A
 * missing *optional* column is reported and treated as empty.
 */
export function mapColumns(
  header: readonly string[],
  required: readonly string[],
  optional: readonly string[] = [],
): MapResult<ColumnMapping> {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[\s_-]+/g, "");

  const normalizedHeader = header.map(normalize);
  const index: Record<string, number> = {};
  const unknown: string[] = [];

  for (const name of [...required, ...optional]) {
    const target = normalize(name);
    const position = normalizedHeader.indexOf(target);
    if (position !== -1) {
      index[name] = position;
    }
  }

  const mapped = new Set(Object.keys(index));
  const claimed = new Set(Object.values(index));
  header.forEach((name, position) => {
    if (!claimed.has(position) && name.trim().length > 0) {
      unknown.push(name.trim());
    }
  });

  const missing = required.filter((name) => !(name in index));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `The file is missing the column${missing.length > 1 ? "s" : ""} ${missing.join(", ")}. Expected a header row with those names.`,
    };
  }
  void mapped;

  return { ok: true, value: { header, index, missing, unknown } };
}

/** Reads one mapped cell, or `null` when the cell is absent or blank. */
export function readCell(
  row: readonly string[],
  mapping: ColumnMapping,
  column: string,
): string | null {
  const position = mapping.index[column];
  if (position === undefined) {
    return null;
  }
  const value = row[position];
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Narrowing helper for callers that hold `unknown` bodies. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
