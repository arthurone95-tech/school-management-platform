import { describe, expect, it } from "vitest";

import { SlidingWindowLimiter, rateLimitKey } from "./rate-limit";

describe("SlidingWindowLimiter", () => {
  it("allows requests up to the limit and then blocks", () => {
    const limiter = new SlidingWindowLimiter(3, 60_000);
    const now = 1_000_000;

    expect(limiter.check("k", now).allowed).toBe(true);
    expect(limiter.check("k", now + 1).allowed).toBe(true);
    expect(limiter.check("k", now + 2).allowed).toBe(true);

    const blocked = limiter.check("k", now + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("slides the window so old attempts stop counting", () => {
    const limiter = new SlidingWindowLimiter(2, 10_000);
    const now = 5_000_000;

    limiter.check("k", now);
    limiter.check("k", now + 100);
    expect(limiter.check("k", now + 200).allowed).toBe(false);

    // Once the first two attempts fall outside the window, the key is free.
    expect(limiter.check("k", now + 10_001).allowed).toBe(true);
  });

  it("keeps separate keys independent", () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    const now = 9_000_000;

    expect(limiter.check("a", now).allowed).toBe(true);
    expect(limiter.check("a", now).allowed).toBe(false);
    expect(limiter.check("b", now).allowed).toBe(true);
  });

  it("rejects nonsensical configuration", () => {
    expect(() => new SlidingWindowLimiter(0, 1000)).toThrow(RangeError);
    expect(() => new SlidingWindowLimiter(1, 0)).toThrow(RangeError);
  });
});

describe("rateLimitKey", () => {
  it("does not include the raw identity", () => {
    const key = rateLimitKey("sign-in", "203.0.113.7", "ama.mensah:ALPHA1");
    expect(key).not.toContain("ama.mensah");
    expect(key).not.toContain("ALPHA1");
    expect(key.startsWith("sign-in:203.0.113.7:")).toBe(true);
  });

  it("separates identities and addresses", () => {
    const first = rateLimitKey("sign-in", "203.0.113.7", "identity-one");
    const second = rateLimitKey("sign-in", "203.0.113.7", "identity-two");
    const otherAddress = rateLimitKey(
      "sign-in",
      "198.51.100.4",
      "identity-one",
    );
    expect(first).not.toBe(second);
    expect(first).not.toBe(otherAddress);
  });

  it("handles an unknown address", () => {
    expect(rateLimitKey("scope", null, "x").startsWith("scope:unknown:")).toBe(
      true,
    );
  });
});
