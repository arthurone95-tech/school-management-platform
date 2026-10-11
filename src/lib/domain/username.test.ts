import { describe, expect, it } from "vitest";

import {
  USERNAME_MAX_LENGTH,
  deriveUsernameBase,
  isValidUsername,
  slugPart,
  usernameWithSuffix,
} from "./username";

describe("slugPart", () => {
  it("lower-cases and removes punctuation and spaces", () => {
    expect(slugPart("Kojo Osei-Bonsu")).toBe("kojooseibonsu");
  });

  it("keeps Ghanaian-language letters as close Latin equivalents", () => {
    expect(slugPart("Kwabɛna")).toBe("kwabena");
    expect(slugPart("Ɔkyeame")).toBe("okyeame");
  });

  it("strips combining diacritics", () => {
    expect(slugPart("Adjoa")).toBe("adjoa");
    expect(slugPart("Amé")).toBe("ame");
  });
});

describe("deriveUsernameBase", () => {
  it("produces first.last", () => {
    expect(deriveUsernameBase("Kojo", "Osei-Bonsu")).toBe("kojo.oseibonsu");
  });

  it("falls back to a prefix when the first name is empty", () => {
    expect(deriveUsernameBase("", "Mensah")).toBe("student.mensah");
    expect(deriveUsernameBase("!!!", "Mensah")).toBe("student.mensah");
  });

  it("never exceeds the maximum length", () => {
    const base = deriveUsernameBase("a".repeat(40), "b".repeat(40));
    expect(base.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });
});

describe("usernameWithSuffix", () => {
  it("returns the base for the first candidate", () => {
    expect(usernameWithSuffix("ama.owusu", 0)).toBe("ama.owusu");
  });

  it("appends an increasing suffix for collisions", () => {
    expect(usernameWithSuffix("ama.owusu", 1)).toBe("ama.owusu2");
    expect(usernameWithSuffix("ama.owusu", 2)).toBe("ama.owusu3");
  });

  it("keeps suffixed usernames within the length limit", () => {
    const base = "a".repeat(USERNAME_MAX_LENGTH);
    const suffixed = usernameWithSuffix(base, 12);
    expect(suffixed.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
    expect(suffixed.endsWith("13")).toBe(true);
  });

  it("rejects a negative or fractional index", () => {
    expect(() => usernameWithSuffix("ama", -1)).toThrow(RangeError);
    expect(() => usernameWithSuffix("ama", 1.5)).toThrow(RangeError);
  });
});

describe("isValidUsername", () => {
  it("accepts generated usernames", () => {
    expect(isValidUsername("ama.owusu")).toBe(true);
    expect(isValidUsername("ama.owusu2")).toBe(true);
    expect(isValidUsername("student")).toBe(true);
  });

  it("rejects values that would not match the pattern", () => {
    expect(isValidUsername(".ama")).toBe(false);
    expect(isValidUsername("Ama")).toBe(false);
    expect(isValidUsername("ama..owusu")).toBe(false);
    expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
  });
});
