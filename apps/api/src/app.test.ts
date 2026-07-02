import { beforeEach, describe, expect, it } from "vitest";
import { getMockAuditTrail } from "./lib/audit";
import { resetRateLimits } from "./lib/rateLimit";
import { createApp } from "./app";

// These tests run in mock mode (no Supabase env), which exercises auth,
// validation, RBAC and rate limiting paths without a database.

const app = createApp();

const userHeaders = { authorization: "Bearer mock-token", "content-type": "application/json" };

beforeEach(() => {
  resetRateLimits();
});

describe("health", () => {
  it("responds on /health", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("vuqiro-api");
  });
});

describe("feed", () => {
  it("returns the for-you feed without auth", async () => {
    const res = await app.request("/feed/for-you");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; playbackUrl?: string; visibility: string }[] };
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("never exposes playback URLs for locked content", async () => {
    const res = await app.request("/feed/for-you");
    const body = (await res.json()) as { items: { playbackUrl?: string; visibility: string }[] };
    for (const item of body.items) {
      if (item.visibility !== "public") {
        expect(item.playbackUrl).toBeUndefined();
      }
    }
  });
});

describe("auth enforcement", () => {
  it("rejects follow without a token", async () => {
    const res = await app.request("/creators/creator_001/follow", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects reports without a token", async () => {
    const res = await app.request("/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType: "video", targetId: "video_001", reason: "spam" })
    });
    expect(res.status).toBe(401);
  });

  it("accepts follow with a token (mock mode)", async () => {
    const res = await app.request("/creators/creator_001/follow", { method: "POST", headers: userHeaders });
    expect(res.status).toBe(200);
  });
});

describe("validation", () => {
  it("rejects invalid report reasons", async () => {
    const res = await app.request("/reports", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ targetType: "video", targetId: "video_001", reason: "not_a_reason" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects empty comments", async () => {
    const res = await app.request("/videos/video_001/comments", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ text: "   " })
    });
    expect(res.status).toBe(400);
  });

  it("rejects tips without an idempotency key", async () => {
    const res = await app.request("/wallet/tip", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creatorId: "creator_001", amount: 100 })
    });
    expect(res.status).toBe(400);
  });

  it("rejects self-blocking", async () => {
    const res = await app.request("/blocks", {
      method: "POST",
      headers: { ...userHeaders, "x-mock-user": "user_me" },
      body: JSON.stringify({ blockedProfileId: "user_me" })
    });
    expect(res.status).toBe(400);
  });
});

describe("rate limiting", () => {
  it("limits report submissions", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 25; i += 1) {
      const res = await app.request("/reports", {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify({ targetType: "video", targetId: `video_${i}`, reason: "spam" })
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("admin RBAC and audit", () => {
  it("rejects admin routes without credentials", async () => {
    const res = await app.request("/admin/dashboard");
    expect(res.status).toBe(401);
  });

  it("serves the dashboard for admins", async () => {
    const res = await app.request("/admin/dashboard", { headers: { authorization: "Bearer admin-token" } });
    expect(res.status).toBe(200);
  });

  it("audit-logs payout holds", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/payouts/payout_007/hold", {
      method: "POST",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({ reason: "manual_admin_hold" })
    });
    expect(res.status).toBe(200);
    const trail = getMockAuditTrail();
    expect(trail.length).toBe(before + 1);
    expect(trail[trail.length - 1].action).toBe("payout_hold");
  });

  it("audit-logs payout releases", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/payouts/payout_006/release", {
      method: "POST",
      headers: { authorization: "Bearer admin-token" }
    });
    expect(res.status).toBe(200);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });
});

describe("webhooks", () => {
  it("refuses RevenueCat events without a configured secret", async () => {
    const res = await app.request("/revenuecat/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { id: "evt_1", type: "INITIAL_PURCHASE" } })
    });
    expect(res.status).toBe(401);
  });

  it("refuses Stripe events without a configured secret", async () => {
    const res = await app.request("/stripe/webhook", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });
});

describe("monetization", () => {
  it("returns the published catalog", async () => {
    const res = await app.request("/monetization/packages");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { packages: unknown[]; versions: unknown[] };
    expect(body.packages.length).toBeGreaterThan(0);
    expect(body.versions.length).toBeGreaterThan(0);
  });
});
