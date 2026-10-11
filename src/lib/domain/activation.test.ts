import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACTIVATION_CODE_LENGTH,
  DEFAULT_ACTIVATION_TTL_HOURS,
  activationExpiry,
  formatActivationCode,
  generateActivationCode,
  isActivationUsable,
  isValidActivationCodeShape,
  normaliseActivationCode,
} from "./activation";

describe("generateActivationCode", () => {
  it("uses the default length and a safe alphabet", () => {
    const code = generateActivationCode();
    expect(code).toHaveLength(DEFAULT_ACTIVATION_CODE_LENGTH);
    expect(isValidActivationCodeShape(code)).toBe(true);
  });

  it("does not produce ambiguous characters", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateActivationCode(24);
      expect(code).not.toMatch(/[ILOSZ01]/);
    }
  });

  it("produces distinct values", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateActivationCode(16)),
    );
    expect(codes.size).toBe(200);
  });

  it("rejects lengths outside the supported range", () => {
    expect(() => generateActivationCode(4)).toThrow(RangeError);
    expect(() => generateActivationCode(1000)).toThrow(RangeError);
  });
});

describe("normaliseActivationCode and formatActivationCode", () => {
  it("ignores separators, case and whitespace", () => {
    expect(normaliseActivationCode(" acde-fghj kmnp ")).toBe("ACDEFGHJKMNP");
  });

  it("groups characters for display and round-trips", () => {
    const formatted = formatActivationCode("ACDEFGHJKMNPQRTU");
    expect(formatted).toBe("ACDE-FGHJ-KMNP-QRTU");
    expect(normaliseActivationCode(formatted)).toBe("ACDEFGHJKMNPQRTU");
  });
});

describe("activationExpiry", () => {
  it("defaults to 72 hours", () => {
    const issuedAt = new Date("2026-10-11T00:00:00.000Z");
    const expiry = activationExpiry(issuedAt);
    expect(expiry.toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(DEFAULT_ACTIVATION_TTL_HOURS).toBe(72);
  });

  it("honours a configured lifetime", () => {
    const issuedAt = new Date("2026-10-11T00:00:00.000Z");
    expect(activationExpiry(issuedAt, 1).toISOString()).toBe(
      "2026-10-11T01:00:00.000Z",
    );
  });

  it("rejects a non-positive lifetime", () => {
    expect(() => activationExpiry(new Date(), 0)).toThrow(RangeError);
    expect(() => activationExpiry(new Date(), -1)).toThrow(RangeError);
  });
});

describe("isActivationUsable", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");

  it("is usable before expiry when unused and not revoked", () => {
    expect(
      isActivationUsable(
        { expiresAt: new Date("2026-10-12T12:00:00.000Z") },
        now,
      ),
    ).toBe(true);
  });

  it("is unusable once expired", () => {
    expect(
      isActivationUsable(
        { expiresAt: new Date("2026-10-11T11:59:59.000Z") },
        now,
      ),
    ).toBe(false);
  });

  it("is unusable after use", () => {
    expect(
      isActivationUsable(
        {
          expiresAt: new Date("2026-10-12T12:00:00.000Z"),
          usedAt: new Date("2026-10-11T10:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("is unusable after revocation, even before expiry", () => {
    expect(
      isActivationUsable(
        {
          expiresAt: new Date("2026-10-12T12:00:00.000Z"),
          revokedAt: new Date("2026-10-11T11:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });
});
