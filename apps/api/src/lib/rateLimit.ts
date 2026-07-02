import { tooManyRequests } from "./errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window in-memory rate limiter. Suitable for a single API instance;
 * swap the store for Redis/Postgres when running multiple instances.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw tooManyRequests();
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}
