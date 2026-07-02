import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

// Webhook auth tests run in mock mode. The processor's DB behaviour
// (credits/reversals/memberships) is exercised against the real schema in
// integration environments; here we verify the security envelope and
// idempotent envelope handling contract.

const SECRET = "rc-test-secret";

describe("revenuecat webhook auth", () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
  });

  function makeRequest(authorization?: string) {
    const app = createApp();
    return app.request("/revenuecat/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization } : {})
      },
      body: JSON.stringify({ event: { id: "evt_1", type: "INITIAL_PURCHASE", app_user_id: "user" } })
    });
  }

  it("rejects missing credentials", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(401);
  });

  it("rejects wrong credentials", async () => {
    const res = await makeRequest("wrong-secret");
    expect(res.status).toBe(401);
  });

  it("accepts the configured secret (plain)", async () => {
    const res = await makeRequest(SECRET);
    expect(res.status).toBe(200);
  });

  it("accepts the configured secret (bearer form)", async () => {
    const res = await makeRequest(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
  });

  it("rejects malformed events", async () => {
    const app = createApp();
    const res = await app.request("/revenuecat/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: SECRET },
      body: JSON.stringify({ event: { no_id: true } })
    });
    expect(res.status).toBe(400);
  });
});

describe("locked content access", () => {
  it("requires auth", async () => {
    const app = createApp();
    const res = await app.request("/videos/video_002/access");
    expect(res.status).toBe(401);
  });

  it("grants access to public videos with playback URL", async () => {
    const app = createApp();
    const res = await app.request("/videos/video_001/access", {
      headers: { authorization: "Bearer token" }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { access: boolean; playbackUrl?: string };
    expect(body.access).toBe(true);
    expect(body.playbackUrl).toBeTruthy();
  });

  it("denies access to locked videos without entitlement (no URL leak)", async () => {
    const app = createApp();
    const res = await app.request("/videos/video_002/access", {
      headers: { authorization: "Bearer token" }
    });
    const body = (await res.json()) as { access: boolean; playbackUrl?: string };
    expect(body.access).toBe(false);
    expect(body.playbackUrl).toBeUndefined();
  });
});
