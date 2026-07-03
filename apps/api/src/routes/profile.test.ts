import { beforeEach, describe, expect, it } from "vitest";
import { getMockAuditTrail } from "../lib/audit";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer user", "content-type": "application/json" };
const adminHeaders = { authorization: "Bearer admin", "x-mock-admin": "1", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("own profile", () => {
  it("requires auth for /me", async () => {
    const res = await app.request("/me");
    expect(res.status).toBe(401);
  });

  it("returns the caller's profile", async () => {
    const res = await app.request("/me", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profile: { handle: string } };
    expect(body.profile.handle.length).toBeGreaterThan(0);
  });

  it("updates profile fields", async () => {
    const res = await app.request("/me", {
      method: "PATCH",
      headers: userHeaders,
      body: JSON.stringify({ displayName: "New Name", bio: "Hello" })
    });
    expect(res.status).toBe(200);
  });

  it("validates website URLs", async () => {
    const res = await app.request("/me", {
      method: "PATCH",
      headers: userHeaders,
      body: JSON.stringify({ websiteUrl: "not-a-url" })
    });
    expect(res.status).toBe(400);
  });
});

describe("settings", () => {
  it("reads privacy settings", async () => {
    const res = await app.request("/me/settings", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings: { personalizedAdsOptIn: boolean } };
    expect(typeof body.settings.personalizedAdsOptIn).toBe("boolean");
  });

  it("updates privacy settings", async () => {
    const res = await app.request("/me/settings", {
      method: "PUT",
      headers: userHeaders,
      body: JSON.stringify({ personalizedAdsOptIn: true, privacyLevel: "followers" })
    });
    expect(res.status).toBe(200);
  });

  it("updates safety settings", async () => {
    const res = await app.request("/me/safety-settings", {
      method: "PUT",
      headers: userHeaders,
      body: JSON.stringify({ restrictedMode: true, commentFilterLevel: "strict" })
    });
    expect(res.status).toBe(200);
  });

  it("replaces interests and validates slugs", async () => {
    const good = await app.request("/me/interests", {
      method: "PUT",
      headers: userHeaders,
      body: JSON.stringify({ interests: ["music", "food"] })
    });
    expect(good.status).toBe(200);

    const bad = await app.request("/me/interests", {
      method: "PUT",
      headers: userHeaders,
      body: JSON.stringify({ interests: ["Not A Slug!"] })
    });
    expect(bad.status).toBe(400);
  });

  it("records consent events", async () => {
    const res = await app.request("/me/consents", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ consentType: "personalized_ads", granted: true, source: "onboarding" })
    });
    expect(res.status).toBe(201);
  });
});

describe("push tokens", () => {
  it("registers a push token", async () => {
    const res = await app.request("/notifications/push-token", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ token: "ExponentPushToken[test-token]", platform: "ios" })
    });
    expect(res.status).toBe(201);
  });

  it("validates token payloads", async () => {
    const res = await app.request("/notifications/push-token", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ token: "x", platform: "toaster" })
    });
    expect(res.status).toBe(400);
  });
});

describe("platform administration", () => {
  it("lists users for admins only", async () => {
    const denied = await app.request("/admin/users");
    expect(denied.status).toBe(401);
    const allowed = await app.request("/admin/users", { headers: adminHeaders });
    expect(allowed.status).toBe(200);
  });

  it("suspends a user with an audit log", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/users/user_001/suspend", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ note: "spam waves" })
    });
    expect(res.status).toBe(200);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });

  it("rejects unknown enforcement actions", async () => {
    const res = await app.request("/admin/users/user_001/obliterate", {
      method: "POST",
      headers: adminHeaders
    });
    expect(res.status).toBe(404);
  });

  it("manages feature flags with audit logging", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/feature-flags/video_upload", {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ enabled: false })
    });
    expect(res.status).toBe(200);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });

  it("updates platform settings with audit logging", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/platform-settings/feed", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ value: { adFrequency: 8 } })
    });
    expect(res.status).toBe(200);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });

  it("exposes integration health to admins", async () => {
    const res = await app.request("/admin/integration-health", { headers: adminHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checks: { provider: string; status: string }[] };
    expect(body.checks.length).toBeGreaterThanOrEqual(5);
  });

  it("queues broadcasts with audit logging", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/notifications/broadcast", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "Hello", body: "Vuqiro update", audience: "all" })
    });
    expect(res.status).toBe(201);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });
});
