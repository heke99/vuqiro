import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };
const adminHeaders = { authorization: "Bearer admin", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("advertiser self-serve", () => {
  it("requires auth on every route", async () => {
    for (const [method, path] of [
      ["GET", "/advertiser/me"],
      ["GET", "/advertiser/campaigns"],
      ["POST", "/advertiser/campaigns"],
      ["GET", "/advertiser/reporting"]
    ] as const) {
      const res = await app.request(path, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({}) : undefined
      });
      expect(res.status).toBe(401);
    }
  });

  it("serves owned advertiser data", async () => {
    const res = await app.request("/advertiser/me", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { advertisers: unknown[] };
    expect(Array.isArray(body.advertisers)).toBe(true);
  });

  it("enforces the minimum budget on campaign creation", async () => {
    const res = await app.request("/advertiser/campaigns", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ advertiserId: "adv_001", name: "Tiny", totalBudgetCents: 100 })
    });
    expect(res.status).toBe(400);
  });

  it("creates draft campaigns", async () => {
    const res = await app.request("/advertiser/campaigns", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ advertiserId: "adv_001", name: "Launch", totalBudgetCents: 50000 })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { campaign: { status: string } };
    expect(body.campaign.status).toBe("draft");
  });

  it("rejects owner transitions that are admin-only", async () => {
    const res = await app.request("/advertiser/campaigns/adcamp_001/activate", {
      method: "POST",
      headers: userHeaders
    });
    expect(res.status).toBe(404);
  });

  it("allows owner-safe transitions", async () => {
    const res = await app.request("/advertiser/campaigns/adcamp_001/pause", {
      method: "POST",
      headers: userHeaders
    });
    expect(res.status).toBe(200);
  });
});

describe("csv exports", () => {
  it("exports ad reporting as csv for admins", async () => {
    const res = await app.request("/admin/ads/reporting?format=csv", { headers: adminHeaders });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body.split("\r\n")[0]).toContain("campaignId");
  });

  it("exports the platform revenue ledger as csv", async () => {
    const res = await app.request("/admin/revenue/platform-ledger?format=csv", { headers: adminHeaders });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("denies csv exports without admin auth", async () => {
    const res = await app.request("/admin/revenue/platform-ledger?format=csv");
    expect(res.status).toBe(401);
  });
});
