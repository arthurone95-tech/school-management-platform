/**
 * Best-effort in-memory rate limiting for the portal endpoints.
 *
 * LIMITATION: this state lives in one process. It slows down repeated guessing
 * against a single instance but does not coordinate across instances, serverless
 * invocations or restarts. It is a brake, not a security boundary, and must not
 * be relied on as the only protection against credential stuffing. The primary
 * controls are the high-entropy activation code, uniform error responses, and
 * Supabase's own auth rate limits.
 *
 * Kept free of timers and I/O so it is deterministic under unit test.
 */

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

interface Bucket {
  readonly hits: number[];
}

export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys: number = 10_000,
  ) {
    if (limit < 1) throw new RangeError("limit must be >= 1");
    if (windowMs < 1) throw new RangeError("windowMs must be >= 1");
  }

  check(key: string, now: number = Date.now()): RateLimitDecision {
    const cutoff = now - this.windowMs;
    const bucket = this.buckets.get(key) ?? { hits: [] };
    const recent = bucket.hits.filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.limit) {
      const oldest = recent[0] ?? now;
      const retryAfterMs = oldest + this.windowMs - now;
      this.buckets.set(key, { hits: recent });
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    recent.push(now);
    this.buckets.set(key, { hits: recent });
    this.pruneIfNeeded(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private pruneIfNeeded(now: number): void {
    if (this.buckets.size <= this.maxKeys) {
      return;
    }
    const cutoff = now - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      if (bucket.hits.every((timestamp) => timestamp <= cutoff)) {
        this.buckets.delete(key);
      }
    }
  }

  /** Test/ops helper. */
  reset(): void {
    this.buckets.clear();
  }
}

/** Sign-in attempts per client, per window. */
export const signInLimiter = new SlidingWindowLimiter(10, 60_000);
/** Activation attempts per client, per window. */
export const activationLimiter = new SlidingWindowLimiter(10, 60_000);

/**
 * Derives a rate-limit key. Combines the caller's network address with the
 * submitted identity so one busy school code cannot lock out another, and a
 * single address cannot spray many identities. The identity part is hashed so
 * raw usernames never appear in memory keys.
 */
export function rateLimitKey(
  scope: string,
  address: string | null,
  identity: string,
): string {
  return `${scope}:${address ?? "unknown"}:${simpleHash(identity)}`;
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
