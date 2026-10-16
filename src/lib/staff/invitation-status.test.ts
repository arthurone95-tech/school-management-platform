import { describe, expect, it } from "vitest";

import {
  deriveInvitationStatus,
  isLiveInvitation,
  type InvitationTimestamps,
} from "./invitation-status";

const NOW = new Date("2026-10-16T12:00:00.000Z");
const FUTURE = "2026-10-19T12:00:00.000Z";
const PAST = "2026-10-15T12:00:00.000Z";

function timestamps(
  overrides: Partial<InvitationTimestamps> = {},
): InvitationTimestamps {
  return {
    acceptedAt: null,
    revokedAt: null,
    expiresAt: FUTURE,
    ...overrides,
  };
}

describe("deriveInvitationStatus", () => {
  it("calls an unaccepted, unrevoked, unexpired row pending", () => {
    expect(deriveInvitationStatus(timestamps(), NOW)).toBe("pending");
    expect(isLiveInvitation(timestamps(), NOW)).toBe(true);
  });

  it("calls a row past its expiry expired", () => {
    expect(deriveInvitationStatus(timestamps({ expiresAt: PAST }), NOW)).toBe(
      "expired",
    );
    expect(isLiveInvitation(timestamps({ expiresAt: PAST }), NOW)).toBe(false);
  });

  it("treats the exact expiry instant as expired", () => {
    expect(
      deriveInvitationStatus(timestamps({ expiresAt: NOW.toISOString() }), NOW),
    ).toBe("expired");
  });

  it("reports an explicit revocation", () => {
    expect(deriveInvitationStatus(timestamps({ revokedAt: PAST }), NOW)).toBe(
      "revoked",
    );
  });

  it("reports acceptance", () => {
    expect(deriveInvitationStatus(timestamps({ acceptedAt: PAST }), NOW)).toBe(
      "accepted",
    );
  });

  it("lets acceptance and revocation outrank expiry", () => {
    expect(
      deriveInvitationStatus(
        timestamps({ acceptedAt: PAST, expiresAt: PAST }),
        NOW,
      ),
    ).toBe("accepted");
    expect(
      deriveInvitationStatus(
        timestamps({ revokedAt: PAST, expiresAt: PAST }),
        NOW,
      ),
    ).toBe("revoked");
  });

  it("lets acceptance outrank revocation if both are somehow set", () => {
    expect(
      deriveInvitationStatus(
        timestamps({ acceptedAt: PAST, revokedAt: PAST }),
        NOW,
      ),
    ).toBe("accepted");
  });
});
