import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StripePayoutsProvider } from "@vuqiro/services";
import { getMockAuditTrail } from "../lib/audit";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };
const adminHeaders = { authorization: "Bearer admin", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("creator payout endpoints", () => {
  it("requires auth for onboarding", async () => {
    const res = await app.request("/payouts/onboarding", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("starts onboarding and returns a link", async () => {
    const res = await app.request("/payouts/onboarding", { method: "POST", headers: userHeaders });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { accountId: string; onboardingUrl: string };
    expect(body.accountId).toContain("acct_mock");
    expect(body.onboardingUrl).toContain("onboarding");
  });

  it("serves the payout dashboard", async () => {
    const res = await app.request("/payouts/me", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { minimumPayout: number };
    expect(body.minimumPayout).toBe(25);
  });
});

describe("payout batches", () => {
  it("requires finance/superadmin role", async () => {
    const res = await app.request("/admin/payouts/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchId: "batch_test_1" })
    });
    expect(res.status).toBe(401);
  });

  it("validates batch ids", async () => {
    const res = await app.request("/admin/payouts/batch", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ batchId: "!!" })
    });
    expect(res.status).toBe(400);
  });

  it("creates a batch and audit-logs it", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/payouts/batch", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ batchId: "batch_2026_07_test" })
    });
    expect(res.status).toBe(201);
    const trail = getMockAuditTrail();
    expect(trail.length).toBe(before + 1);
    expect(trail[trail.length - 1].action).toBe("payout_create");
  });
});

describe("stripe webhook signature verification", () => {
  const secret = "whsec_test";
  const provider = new StripePayoutsProvider({ secretKey: "sk_test", webhookSecret: secret });
  const body = JSON.stringify({ id: "evt_1", type: "account.updated", data: { object: { id: "acct_1" } } });

  function sign(payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
    const hmac = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    return `t=${timestamp},v1=${hmac}`;
  }

  it("accepts valid signatures", () => {
    expect(provider.verifyWebhookSignature(body, sign(body)).valid).toBe(true);
  });

  it("rejects tampered payloads", () => {
    expect(provider.verifyWebhookSignature(body.replace("acct_1", "acct_2"), sign(body)).valid).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(provider.verifyWebhookSignature(body, sign(body, old)).valid).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    const bare = new StripePayoutsProvider({ secretKey: "sk_test" });
    expect(bare.verifyWebhookSignature(body, sign(body)).valid).toBe(false);
  });
});

describe("stripe webhook endpoint", () => {
  const secret = "whsec_endpoint_test";

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects unsigned events", async () => {
    const freshApp = createApp();
    const res = await freshApp.request("/stripe/webhook", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("accepts correctly signed events", async () => {
    const freshApp = createApp();
    const body = JSON.stringify({ id: "evt_2", type: "account.updated", data: { object: { id: "acct_x" } } });
    const timestamp = Math.floor(Date.now() / 1000);
    const hmac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const res = await freshApp.request("/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": `t=${timestamp},v1=${hmac}` },
      body
    });
    expect(res.status).toBe(200);
  });
});
