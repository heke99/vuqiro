import { beforeEach, describe, expect, it } from "vitest";
import { getMockAuditTrail } from "../lib/audit";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const adminHeaders = { authorization: "Bearer admin", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("fraud signals", () => {
  it("requires admin", async () => {
    const res = await app.request("/admin/fraud-signals");
    expect(res.status).toBe(401);
  });

  it("lists signals for admins", async () => {
    const res = await app.request("/admin/fraud-signals", { headers: adminHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { signals: unknown[] };
    expect(body.signals.length).toBeGreaterThan(0);
  });

  it("validates resolutions", async () => {
    const res = await app.request("/admin/fraud-signals/fraud_001/resolve", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ resolution: "vaporized" })
    });
    expect(res.status).toBe(400);
  });

  it("resolves signals with an audit log", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/fraud-signals/fraud_002/resolve", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ resolution: "dismissed" })
    });
    expect(res.status).toBe(200);
    expect(getMockAuditTrail().length).toBe(before + 1);
  });
});
