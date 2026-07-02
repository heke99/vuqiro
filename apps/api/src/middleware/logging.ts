import type { Context, Next } from "hono";

/**
 * Structured request logging without PII: method, path, status, duration and
 * an anonymous request id. Bodies, tokens, emails and query values are never
 * logged.
 */
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  c.header("x-request-id", requestId);
  try {
    await next();
  } finally {
    const entry = {
      level: c.res.status >= 500 ? "error" : "info",
      requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Date.now() - start
    };
    console.log(JSON.stringify(entry));
  }
}

/** Baseline security headers for an API service. */
export async function securityHeaders(c: Context, next: Next) {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("x-frame-options", "DENY");
  c.header("referrer-policy", "no-referrer");
  c.header("cache-control", "no-store");
}
