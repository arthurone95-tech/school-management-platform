import { describe, expect, it } from "vitest";

import {
  ACTIVATION_FAILURE_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SIGN_IN_FAILURE_MESSAGE,
  parseActivateInput,
  parseSignInInput,
} from "./requests";

describe("parseSignInInput", () => {
  it("normalises the school code and username", () => {
    const result = parseSignInInput({
      schoolCode: " alpha-1 ",
      username: " Ama.Mensah ",
      password: "correct horse",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        schoolCode: "ALPHA1",
        username: "ama.mensah",
        password: "correct horse",
      },
    });
  });

  it("rejects a request that is not an object", () => {
    const result = parseSignInInput("nope");
    expect(result.ok).toBe(false);
  });

  it("asks for all fields when one is missing", () => {
    const result = parseSignInInput({
      schoolCode: "ALPHA1",
      username: "ama.mensah",
    });
    expect(result).toEqual({
      ok: false,
      message: "Enter your school code, username and password.",
    });
  });

  it("uses the uniform message for a malformed school code", () => {
    const result = parseSignInInput({
      schoolCode: "AB",
      username: "ama.mensah",
      password: "correct horse",
    });
    expect(result).toEqual({ ok: false, message: SIGN_IN_FAILURE_MESSAGE });
  });

  it("uses the uniform message for a malformed username", () => {
    const result = parseSignInInput({
      schoolCode: "ALPHA1",
      username: "ama mensah",
      password: "correct horse",
    });
    expect(result).toEqual({ ok: false, message: SIGN_IN_FAILURE_MESSAGE });
  });

  it("uses the uniform message for an empty or over-long password", () => {
    const empty = parseSignInInput({
      schoolCode: "ALPHA1",
      username: "ama.mensah",
      password: "",
    });
    const tooLong = parseSignInInput({
      schoolCode: "ALPHA1",
      username: "ama.mensah",
      password: "x".repeat(PASSWORD_MAX_LENGTH + 1),
    });
    expect(empty).toEqual({ ok: false, message: SIGN_IN_FAILURE_MESSAGE });
    expect(tooLong).toEqual({ ok: false, message: SIGN_IN_FAILURE_MESSAGE });
  });

  it("does not trim or alter the password value", () => {
    const result = parseSignInInput({
      schoolCode: "ALPHA1",
      username: "ama.mensah",
      password: " spaces kept ",
    });
    expect(result.ok && result.value.password).toBe(" spaces kept ");
  });
});

describe("parseActivateInput", () => {
  it("normalises a formatted code", () => {
    const result = parseActivateInput({
      code: "acde-fghj-kmnp",
      newPassword: "a-good-password",
      confirmPassword: "a-good-password",
    });
    expect(result).toEqual({
      ok: true,
      value: { code: "ACDEFGHJKMNP", newPassword: "a-good-password" },
    });
  });

  it("rejects a code that is too short", () => {
    const result = parseActivateInput({
      code: "ABC",
      newPassword: "a-good-password",
      confirmPassword: "a-good-password",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a code containing characters outside the alphabet", () => {
    // `I` is deliberately excluded from the generation alphabet.
    const result = parseActivateInput({
      code: "ABCDEFGIJK",
      newPassword: "a-good-password",
      confirmPassword: "a-good-password",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched passwords before checking strength", () => {
    const result = parseActivateInput({
      code: "ACDEFGHJKMNP",
      newPassword: "a-good-password",
      confirmPassword: "a-different-password",
    });
    expect(result).toEqual({
      ok: false,
      message: "The two passwords do not match.",
    });
  });

  it("enforces the password length bounds", () => {
    const short = parseActivateInput({
      code: "ACDEFGHJKMNP",
      newPassword: "x".repeat(PASSWORD_MIN_LENGTH - 1),
      confirmPassword: "x".repeat(PASSWORD_MIN_LENGTH - 1),
    });
    const long = parseActivateInput({
      code: "ACDEFGHJKMNP",
      newPassword: "x".repeat(PASSWORD_MAX_LENGTH + 1),
      confirmPassword: "x".repeat(PASSWORD_MAX_LENGTH + 1),
    });
    expect(short.ok).toBe(false);
    expect(long.ok).toBe(false);
  });

  it("exposes a uniform activation failure message", () => {
    expect(ACTIVATION_FAILURE_MESSAGE).toMatch(
      /not valid or has already been used or has expired/,
    );
  });
});
