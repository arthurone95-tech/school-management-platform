import { describe, expect, it } from "vitest";

import {
  buildStaffInvitationLink,
  generateInvitationToken,
  isValidInvitationTokenShape,
  parseInvitationTokenFragment,
  STAFF_INVITATION_TTL_HOURS,
} from "./invitations";

describe("staff invitation helpers (pure)", () => {
  it("generates a 64-character lowercase hex token", () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token.length).toBe(64);
  });

  it("tokens are statistically unlikely to collide across many generations", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const token = generateInvitationToken();
      expect(seen.has(token)).toBe(false);
      seen.add(token);
    }
  });

  it("validates token shape strictly", () => {
    expect(isValidInvitationTokenShape(generateInvitationToken())).toBe(true);
    expect(isValidInvitationTokenShape("abc")).toBe(false);
    expect(isValidInvitationTokenShape(null)).toBe(false);
    expect(isValidInvitationTokenShape(123)).toBe(false);
  });

  it("builds a fragment link (no query token)", () => {
    const token = generateInvitationToken();
    const link = buildStaffInvitationLink("https://app.example.com", token);
    expect(link).toBe(`https://app.example.com/join#token=${token}`);
    expect(link.includes("?token=")).toBe(false);
  });

  it("parses token from hash fragment", () => {
    const token = generateInvitationToken();
    expect(parseInvitationTokenFragment(`#token=${token}`)).toBe(token);
    expect(parseInvitationTokenFragment(`token=${token}`)).toBe(token);
  });

  it("returns null for malformed fragments", () => {
    expect(parseInvitationTokenFragment("#")).toBeNull();
    expect(parseInvitationTokenFragment("#token=nothex")).toBeNull();
    expect(parseInvitationTokenFragment("")).toBeNull();
  });

  it("reuses the 72-hour default expiry", () => {
    expect(STAFF_INVITATION_TTL_HOURS).toBe(72);
  });
});
