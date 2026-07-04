import { beforeEach, describe, expect, it } from "vitest";
import { getMockAuditTrail } from "../lib/audit";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer user", "content-type": "application/json" };
const adminHeaders = { authorization: "Bearer admin", "x-mock-admin": "1", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("ad serving", () => {
  it("serves ads for the feed placement", async () => {
    const res = await app.request("/ads/serve?placement=feed&count=2");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ads: { kind: string; title: string; ctaUrl: string }[] };
    expect(body.ads.length).toBeGreaterThan(0);
    expect(body.ads[0].kind).toBe("ad");
    expect(body.ads[0].title.length).toBeGreaterThan(0);
    expect(body.ads[0].ctaUrl).toMatch(/^https?:/);
  });

  it("rejects unknown placements", async () => {
    const res = await app.request("/ads/serve?placement=popup");
    expect(res.status).toBe(400);
  });

  it("records impressions", async () => {
    const res = await app.request("/ads/impression", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creativeId: "adcr_001", placement: "feed" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recorded: boolean };
    expect(body.recorded).toBe(true);
  });

  it("records clicks", async () => {
    const res = await app.request("/ads/click", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creativeId: "adcr_001", placement: "feed" })
    });
    expect(res.status).toBe(200);
  });

  it("requires auth for ad reports", async () => {
    const res = await app.request("/ads/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creativeId: "adcr_001", reason: "misleading" })
    });
    expect(res.status).toBe(401);
  });

  it("accepts ad reports from signed-in users", async () => {
    const res = await app.request("/ads/report", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creativeId: "adcr_001", reason: "misleading" })
    });
    expect(res.status).toBe(201);
  });

  it("validates ad report reasons", async () => {
    const res = await app.request("/ads/report", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creativeId: "adcr_001", reason: "did_not_like_it" })
    });
    expect(res.status).toBe(400);
  });
});

describe("feed ad insertion", () => {
  it("inserts sponsored entries into the for-you feed", async () => {
    const res = await app.request("/feed/for-you");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { kind?: string }[]; nextCursor: string | null };
    const ads = body.items.filter((item) => item.kind === "ad");
    const videos = body.items.filter((item) => item.kind !== "ad");
    expect(ads.length).toBeGreaterThan(0);
    expect(videos.length).toBeGreaterThan(0);
  });

  it("paginates with a cursor", async () => {
    const first = await app.request("/feed/for-you");
    const firstBody = (await first.json()) as { items: { id?: string }[]; nextCursor: string | null };
    expect(firstBody.nextCursor).toBeTruthy();

    const second = await app.request(`/feed/for-you?cursor=${encodeURIComponent(firstBody.nextCursor!)}`);
    const secondBody = (await second.json()) as { items: { id?: string; kind?: string }[] };
    expect(second.status).toBe(200);
    const firstIds = new Set(firstBody.items.map((item) => item.id).filter(Boolean));
    const overlap = secondBody.items.filter((item) => item.kind !== "ad" && firstIds.has(item.id));
    expect(overlap).toHaveLength(0);
  });

  it("serves the trending feed", async () => {
    const res = await app.request("/feed/trending");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items.length).toBeGreaterThan(0);
  });
});

describe("ads administration", () => {
  it("requires admin for the ads suite", async () => {
    const res = await app.request("/admin/ads/campaigns");
    expect(res.status).toBe(401);
  });

  it("lists campaigns for admins", async () => {
    const res = await app.request("/admin/ads/campaigns", { headers: adminHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { campaigns: unknown[] };
    expect(body.campaigns.length).toBeGreaterThan(0);
  });

  it("creates an advertiser with an audit log", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/ads/advertisers", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ name: "Test Co" })
    });
    expect(res.status).toBe(201);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });

  it("rejects fixed sponsorship campaigns without a price", async () => {
    const res = await app.request("/admin/ads/campaigns", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        adAccountId: "adacct_001",
        advertiserId: "adv_001",
        name: "No price",
        buyingType: "fixed_sponsorship"
      })
    });
    expect(res.status).toBe(400);
  });

  it("validates campaign transitions", async () => {
    const res = await app.request("/admin/ads/campaigns/adcamp_001/vaporize", {
      method: "POST",
      headers: adminHeaders
    });
    expect(res.status).toBe(404);
  });

  it("approves creatives with an audit log", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/ads/creatives/adcr_003/approve", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({})
    });
    expect(res.status).toBe(200);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });

  it("activates sponsorships with an audit log", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/ads/sponsorships/spon_001/activate", {
      method: "POST",
      headers: adminHeaders
    });
    expect(res.status).toBe(200);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });

  it("exposes delivery reporting", async () => {
    const res = await app.request("/admin/ads/reporting", { headers: adminHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reporting: { impressions: number }[] };
    expect(body.reporting.length).toBeGreaterThan(0);
  });

  it("exposes the platform revenue ledger", async () => {
    const res = await app.request("/admin/revenue/platform-ledger", { headers: adminHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: { source: string }[] };
    expect(body.entries.some((entry) => entry.source === "sponsorship")).toBe(true);
  });
});
