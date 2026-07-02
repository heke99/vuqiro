import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("notifications", () => {
  it("requires auth for the inbox", async () => {
    const res = await app.request("/notifications");
    expect(res.status).toBe(401);
  });

  it("returns the inbox with unread count", async () => {
    const res = await app.request("/notifications", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notifications: unknown[]; unread: number };
    expect(body.notifications.length).toBeGreaterThan(0);
    expect(body.unread).toBeGreaterThanOrEqual(0);
  });

  it("requires a target for mark-read", async () => {
    const res = await app.request("/notifications/read", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);
  });

  it("marks all read", async () => {
    const res = await app.request("/notifications/read", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ all: true })
    });
    expect(res.status).toBe(200);
  });

  it("serves preferences", async () => {
    const res = await app.request("/notifications/preferences", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { preferences: Record<string, boolean> };
    expect(body.preferences).toBeTruthy();
  });

  it("validates preference updates", async () => {
    const res = await app.request("/notifications/preferences", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ followers: "yes" })
    });
    expect(res.status).toBe(400);
  });

  it("saves preference updates including push tokens", async () => {
    const res = await app.request("/notifications/preferences", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ pushEnabled: true, pushToken: "ExponentPushToken[test]" })
    });
    expect(res.status).toBe(200);
  });
});
