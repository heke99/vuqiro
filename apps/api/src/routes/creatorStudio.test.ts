import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("creator studio endpoints", () => {
  it("requires auth everywhere", async () => {
    for (const path of ["/creators/me/videos", "/creators/me/subscribers", "/creators/me/moderation"]) {
      const res = await app.request(path);
      expect(res.status, path).toBe(401);
    }
  });

  it("returns own videos including moderation state", async () => {
    const res = await app.request("/creators/me/videos", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("returns subscriber overview without payment details", async () => {
    const res = await app.request("/creators/me/subscribers", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totals: { active: number }; recent: Record<string, unknown>[] };
    expect(body.totals.active).toBeGreaterThanOrEqual(0);
    for (const row of body.recent) {
      expect(row).not.toHaveProperty("store_transaction_id");
      expect(row).not.toHaveProperty("price_amount");
    }
  });

  it("returns moderation standing", async () => {
    const res = await app.request("/creators/me/moderation", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { warnings: number; cases: unknown[] };
    expect(body.warnings).toBeGreaterThanOrEqual(0);
  });

  it("validates tier settings", async () => {
    const res = await app.request("/creators/me/tiers", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ tiersEnabled: ["diamond"] })
    });
    expect(res.status).toBe(400);
  });

  it("saves valid tier settings", async () => {
    const res = await app.request("/creators/me/tiers", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ tiersEnabled: ["support", "plus"] })
    });
    expect(res.status).toBe(200);
  });

  it("supports creator onboarding", async () => {
    const res = await app.request("/creators/onboard", { method: "POST", headers: userHeaders });
    expect(res.status).toBe(201);
  });
});
