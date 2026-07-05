import { tooManyRequests } from "./errors";
import { getServiceDb, isBackendConfigured } from "./supabase";

type Bucket = { count: number; resetAt: number; violationLoggedAt?: number };

const buckets = new Map<string, Bucket>();

/** Persist at most one violation row per key per this window. */
const VIOLATION_LOG_THROTTLE_MS = 60_000;

/** UUID shape check: profile-scoped keys log the profile id, others don't. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function logViolation(key: string, limit: number, windowMs: number): void {
  if (!isBackendConfigured()) return;
  const db = getServiceDb()!;
  const separator = key.indexOf(":");
  const scope = separator > 0 ? key.slice(0, separator) : key;
  const limiterId = separator > 0 ? key.slice(separator + 1) : "";
  void db
    .from("rate_limit_events")
    .insert({
      scope,
      limiter_key: key.slice(0, 200),
      profile_id: UUID_RE.test(limiterId) ? limiterId : null,
      limit_max: limit,
      window_ms: windowMs
    })
    .then(() => undefined);
}

/**
 * Fixed-window in-memory rate limiter. Suitable for a single API instance;
 * swap the store for Redis/Postgres when running multiple instances.
 * Violations are persisted (throttled) to rate_limit_events for ops review.
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
    if (!bucket.violationLoggedAt || now - bucket.violationLoggedAt > VIOLATION_LOG_THROTTLE_MS) {
      bucket.violationLoggedAt = now;
      logViolation(key, limit, windowMs);
    }
    throw tooManyRequests();
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}
