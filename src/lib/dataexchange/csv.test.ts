import { describe, expect, it } from "vitest";

import {
  CSV_MAX_ROWS,
  escapeCsvValue,
  mapColumns,
  neutralizeFormula,
  parseCsv,
  readCell,
  toCsv,
} from "./csv";
import {
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATE_EXAMPLE,
  IMPORT_TEMPLATE_HEADER,
  REQUIRED_COLUMNS,
  parseLearnerImport,
} from "./learner-import";

const HEADER = IMPORT_TEMPLATE_HEADER.join(",");

function csv(...rows: string[]) {
  return `${[HEADER, ...rows].join("\n")}\n`;
}

function learnerRow(over: Record<string, string> = {}) {
  const values = {
    registration_number: "A-001",
    first_name: "Ama",
    last_name: "Bello",
    gender: "female",
    date_of_birth: "2016-05-04",
    residential_address: "Plot 3",
    guardian_phone: "0240000001",
    guardian_email: "",
    class_name: "Primary 1",
    ...over,
  };
  return IMPORT_TEMPLATE_HEADER.map((key) => values[key] ?? "").join(",");
}

const classIds: Record<string, string> = {
  "Primary 1": "11111111-1111-4111-8111-111111111111",
};

describe("parseCsv", () => {
  it("parses a header and rows", () => {
    const result = parseCsv(csv(learnerRow()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.header).toEqual([...IMPORT_TEMPLATE_HEADER]);
      expect(result.value.rows).toHaveLength(1);
      expect(result.value.rows[0][1]).toBe("Ama");
    }
  });

  it("keeps a comma inside a quoted value", () => {
    const result = parseCsv(`${HEADER}\n"A-001","Bello, Ama"\n`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows[0][1]).toBe("Bello, Ama");
    }
  });

  it("unescapes a doubled quote", () => {
    const result = parseCsv(`${HEADER}\n"A-001","O""Brien"\n`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows[0][1]).toBe('O"Brien');
    }
  });

  it("keeps a newline inside a quoted value", () => {
    const result = parseCsv(`${HEADER}\n"A-001","Plot 3\nNear the tree"\n`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows[0][1]).toBe("Plot 3\nNear the tree");
      expect(result.value.rows).toHaveLength(1);
    }
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv(`${HEADER}\r\n"A-001","Ama"\r\n`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1);
      expect(result.value.rows[0][1]).toBe("Ama");
    }
  });

  it("ignores a trailing blank line", () => {
    const result = parseCsv(`${HEADER}\n"A-001","Ama"\n\n`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1);
    }
  });

  it("rejects an unmatched quote and names the line it started on", () => {
    const result = parseCsv(`${HEADER}\n"A-001","unclosed\n`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/starting on line 2/);
    }
  });

  it("rejects an empty file and one with no header", () => {
    expect(parseCsv("").ok).toBe(false);
    expect(parseCsv("\n\n").ok).toBe(false);
  });

  it("rejects a row wider than the header", () => {
    const wide = `${Array.from({ length: IMPORT_TEMPLATE_HEADER.length + 1 }, () => '"x"').join(",")}`;
    const result = parseCsv(`${HEADER}\n${wide}\n`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Row 2/);
    }
  });

  it("accepts a row narrower than the header, padding it as blanks", () => {
    const result = parseCsv(`${HEADER}\n"A-001","Ama"\n`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1);
      expect(result.value.rows[0]).toHaveLength(2);
    }
  });

  it("refuses more rows than the bound allows", () => {
    const many = Array.from({ length: CSV_MAX_ROWS + 2 }, () =>
      learnerRow(),
    ).join("\n");
    expect(parseCsv(`${HEADER}\n${many}\n`).ok).toBe(false);
  });
});

describe("neutralizeFormula", () => {
  it("defuses a leading spreadsheet formula character", () => {
    expect(neutralizeFormula("=1+1")).toBe("'=1+1");
    expect(neutralizeFormula("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(neutralizeFormula("@cmd")).toBe("'@cmd");
    expect(neutralizeFormula("-2+3")).toBe("'-2+3");
  });

  it("leaves ordinary text and numbers alone", () => {
    expect(neutralizeFormula("Ama")).toBe("Ama");
    expect(neutralizeFormula("2016-05-04")).toBe("2016-05-04");
    expect(neutralizeFormula("")).toBe("");
  });

  it("only applies to the start of the value", () => {
    expect(neutralizeFormula("Plot =3")).toBe("Plot =3");
  });
});

describe("escapeCsvValue and toCsv", () => {
  it("quotes a value containing a comma", () => {
    expect(escapeCsvValue("Bello, Ama")).toBe('"Bello, Ama"');
  });

  it("doubles an embedded quote", () => {
    expect(escapeCsvValue('O"Brien')).toBe('"O""Brien"');
  });

  it("defuses a formula in an exported cell", () => {
    expect(escapeCsvValue('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it("round-trips through the parser", () => {
    const table = {
      header: ["a", "b"],
      rows: [
        ["Bello, Ama", 'O"Brien'],
        ["line\nbreak", "plain"],
      ],
    };
    const text = toCsv(table);
    const parsed = parseCsv(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.rows).toEqual([
        ["Bello, Ama", 'O"Brien'],
        ["line\nbreak", "plain"],
      ]);
    }
  });

  it("ends with a newline so a spreadsheet reads every row", () => {
    expect(toCsv({ header: ["a"], rows: [] })).toBe("a\n");
  });
});

describe("mapColumns", () => {
  it("matches regardless of case, spaces and underscores", () => {
    const result = mapColumns(
      ["Registration Number", "FIRST_NAME", "last name", "Class_Name"],
      ["registration_number", "first_name", "last_name", "class_name"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.index["registration_number"]).toBe(0);
      expect(result.value.index["class_name"]).toBe(3);
    }
  });

  it("refuses a file missing a required column and names it", () => {
    const result = mapColumns(
      ["registration_number", "first_name"],
      ["registration_number", "first_name", "class_name"],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/class_name/);
    }
  });

  it("treats a missing optional column as absent rather than failing", () => {
    const result = mapColumns(
      ["registration_number"],
      ["registration_number"],
      ["guardian_email"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.missing).toEqual([]);
    }
  });

  it("reports columns it does not use", () => {
    const result = mapColumns(
      ["registration_number", "shoe_size"],
      ["registration_number"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unknown).toEqual(["shoe_size"]);
    }
  });
});

describe("readCell", () => {
  const mapping = mapColumns(["a", "b", "c"], ["a", "b"]);

  it("reads, trims and blanks a cell", () => {
    expect(mapping.ok).toBe(true);
    if (!mapping.ok) {
      return;
    }
    const row = ["  x  ", "", "y"];
    expect(readCell(row, mapping.value, "a")).toBe("x");
    expect(readCell(row, mapping.value, "b")).toBeNull();
    expect(readCell(row, mapping.value, "c")).toBeNull();
  });

  it("returns null for a column that is not mapped", () => {
    expect(mapping.ok).toBe(true);
    if (mapping.ok) {
      expect(readCell(["x"], mapping.value, "z")).toBeNull();
    }
  });
});

describe("parseLearnerImport", () => {
  function parse(text: string) {
    const table = parseCsv(text);
    if (!table.ok) {
      return { ok: false as const, message: table.message };
    }
    return parseLearnerImport({
      table: table.value,
      classNameToId: (name) => classIds[name] ?? null,
    });
  }

  it("accepts a well-formed row and reports its file line", () => {
    const result = parse(csv(learnerRow()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1);
      expect(result.value.rows[0].row).toBe(2);
      expect(result.value.rows[0].input.registrationNumber).toBe("A-001");
      expect(result.value.rows[0].input.classId).toBe(classIds["Primary 1"]);
      expect(result.value.issues).toHaveLength(0);
    }
  });

  it("runs the same validation as single enrolment", () => {
    const result = parse(csv(learnerRow({ gender: "unknown" })));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(0);
      expect(result.value.issues[0]?.row).toBe(2);
      expect(result.value.issues[0]?.message).toMatch(/gender/i);
    }
  });

  it("refuses a future date of birth through the enrolment rules", () => {
    const result = parse(csv(learnerRow({ date_of_birth: "2099-01-01" })));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(0);
      expect(result.value.issues).toHaveLength(1);
    }
  });

  it("reports an unknown class rather than creating a learner in none", () => {
    const result = parse(csv(learnerRow({ class_name: "Primary 9" })));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(0);
      expect(result.value.issues[0]?.message).toMatch(/Primary 9/);
    }
  });

  it("reports a blank class", () => {
    const result = parse(csv(learnerRow({ class_name: "" })));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues[0]?.message).toMatch(/class is blank/i);
    }
  });

  it("keeps going after a bad row and numbers the good ones correctly", () => {
    const result = parse(
      csv(
        learnerRow({ registration_number: "A-001" }),
        learnerRow({ registration_number: "" }),
        learnerRow({ registration_number: "A-003" }),
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows.map((row) => row.row)).toEqual([2, 4]);
      expect(result.value.issues.map((issue) => issue.row)).toEqual([3]);
      expect(result.value.issues[0]?.registrationNumber).toBeNull();
    }
  });

  it("refuses a file missing a required column before reading any row", () => {
    const result = parse("registration_number,first_name\nA-001,Ama\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/missing the column/);
    }
  });

  it("lists the columns it ignores so the user is not silently surprised", () => {
    const withExtra = `${[...IMPORT_TEMPLATE_HEADER, "house"].join(",")}\n${[
      ...IMPORT_TEMPLATE_EXAMPLE,
      "Blue",
    ].join(",")}\n`;
    const result = parse(withExtra);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ignoredColumns).toEqual(["house"]);
      expect(result.value.rows).toHaveLength(1);
    }
  });

  it("bounds a batch so one request cannot hold the connection open", () => {
    expect(IMPORT_MAX_ROWS).toBe(100);
    expect(REQUIRED_COLUMNS).toContain("class_name");
  });
});
