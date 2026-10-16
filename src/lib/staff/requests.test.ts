import { describe, expect, it } from "vitest";

import { PASSWORD_MAX_LENGTH } from "@/lib/portal/requests";

import {
  EMAIL_MAX_LENGTH,
  INVITATION_INVALID_MESSAGE,
  parseStaffInvitationAcceptInput,
  parseStaffInvitationRevokeInput,
  parseStaffInvitationTokenInput,
  parseStaffInviteInput,
  parseStaffSignInInput,
} from "./requests";

describe("parseStaffSignInInput", () => {
  it("normalises the email and accepts a valid password", () => {
    const result = parseStaffSignInInput({
      email: "  Ama.Mensah@Example.COM ",
      password: "correct horse",
    });

    expect(result).toEqual({
      ok: true,
      value: { email: "ama.mensah@example.com", password: "correct horse" },
    });
  });

  it("rejects a request that is not an object", () => {
    expect(parseStaffSignInInput("nope").ok).toBe(false);
  });

  it("asks for both fields when one is missing", () => {
    const result = parseStaffSignInInput({ email: "a@example.com" });
    expect(result).toEqual({
      ok: false,
      message: "Enter your email and password.",
    });
  });

  it("uses the uniform failure message for an invalid email or empty password", () => {
    const badEmail = parseStaffSignInInput({
      email: "not-an-email",
      password: "correct horse",
    });
    expect(badEmail).toEqual({
      ok: false,
      message: "Email or password is incorrect.",
    });

    const emptyPassword = parseStaffSignInInput({
      email: "a@example.com",
      password: "",
    });
    expect(emptyPassword.ok).toBe(false);
    expect(emptyPassword).toEqual({
      ok: false,
      message: "Email or password is incorrect.",
    });
  });

  it("rejects an over-long password", () => {
    const result = parseStaffSignInInput({
      email: "a@example.com",
      password: "x".repeat(PASSWORD_MAX_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseStaffInviteInput", () => {
  it("accepts the D-021 school staff roles", () => {
    for (const role of ["school_administrator", "teacher"]) {
      const result = parseStaffInviteInput({
        email: "Ama@Example.com",
        role,
      });
      expect(result).toEqual({
        ok: true,
        value: { email: "ama@example.com", role },
      });
    }
  });

  it("rejects a role outside the school staff set", () => {
    const result = parseStaffInviteInput({
      email: "ama@example.com",
      role: "platform_owner",
    });
    expect(result).toEqual({
      ok: false,
      message: "Choose a valid staff role.",
    });
  });

  it("rejects an invalid email", () => {
    const result = parseStaffInviteInput({
      email: "ama",
      role: "teacher",
    });
    expect(result).toEqual({
      ok: false,
      message: "Enter a valid email address.",
    });
  });

  it("rejects an over-long email", () => {
    const result = parseStaffInviteInput({
      email: `${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`,
      role: "teacher",
    });
    expect(result.ok).toBe(false);
  });

  it("asks for both fields when one is missing", () => {
    const result = parseStaffInviteInput({ role: "teacher" });
    expect(result).toEqual({
      ok: false,
      message: "Enter the email address and role for the invitation.",
    });
  });
});

const VALID_TOKEN = "a".repeat(64);
const INVITATION_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("parseStaffInvitationTokenInput", () => {
  it("accepts a well-formed token", () => {
    expect(parseStaffInvitationTokenInput({ token: VALID_TOKEN })).toEqual({
      ok: true,
      value: { token: VALID_TOKEN },
    });
  });

  it("rejects a malformed or missing token with the uniform message", () => {
    expect(parseStaffInvitationTokenInput({ token: "short" })).toEqual({
      ok: false,
      message: INVITATION_INVALID_MESSAGE,
    });
    expect(parseStaffInvitationTokenInput({})).toEqual({
      ok: false,
      message: INVITATION_INVALID_MESSAGE,
    });
    expect(parseStaffInvitationTokenInput("nope")).toEqual({
      ok: false,
      message: INVITATION_INVALID_MESSAGE,
    });
  });
});

describe("parseStaffInvitationAcceptInput", () => {
  it("accepts a valid token and password", () => {
    expect(
      parseStaffInvitationAcceptInput({
        token: VALID_TOKEN,
        password: "correct horse",
      }),
    ).toEqual({
      ok: true,
      value: { token: VALID_TOKEN, password: "correct horse" },
    });
  });

  it("rejects a short password", () => {
    expect(
      parseStaffInvitationAcceptInput({
        token: VALID_TOKEN,
        password: "short",
      }),
    ).toEqual({
      ok: false,
      message: "Your password must be at least 8 characters.",
    });
  });

  it("rejects an over-long password", () => {
    expect(
      parseStaffInvitationAcceptInput({
        token: VALID_TOKEN,
        password: "x".repeat(PASSWORD_MAX_LENGTH + 1),
      }),
    ).toEqual({
      ok: false,
      message: "Your password must be 72 characters or fewer.",
    });
  });

  it("rejects a malformed token before checking the password", () => {
    expect(
      parseStaffInvitationAcceptInput({
        token: "bad",
        password: "correct horse",
      }),
    ).toEqual({ ok: false, message: INVITATION_INVALID_MESSAGE });
  });
});

describe("parseStaffInvitationRevokeInput", () => {
  it("accepts a UUID invitation id", () => {
    expect(
      parseStaffInvitationRevokeInput({ invitationId: INVITATION_ID }),
    ).toEqual({
      ok: true,
      value: { invitationId: INVITATION_ID },
    });
  });

  it("rejects a non-UUID or missing id", () => {
    expect(
      parseStaffInvitationRevokeInput({ invitationId: "not-a-uuid" }),
    ).toEqual({
      ok: false,
      message: "Invalid request body.",
    });
    expect(parseStaffInvitationRevokeInput({})).toEqual({
      ok: false,
      message: "Invalid request body.",
    });
  });
});
