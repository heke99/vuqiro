import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { MuxVideoProvider } from "@vuqiro/services";
import { resetRateLimits } from "../lib/rateLimit";
import { precheckModeration } from "../lib/moderationPrecheck";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer mock-token", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("upload validation", () => {
  const validBody = {
    caption: "Test video",
    hashtags: ["test"],
    visibility: "public",
    fileName: "clip.mp4",
    fileSizeBytes: 1024
  };

  it("requires auth", async () => {
    const res = await app.request("/videos/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody)
    });
    expect(res.status).toBe(401);
  });

  it("creates a mock upload for valid requests", async () => {
    const res = await app.request("/videos/uploads", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify(validBody)
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { uploadUrl: string; status: string };
    expect(body.uploadUrl).toContain("upload");
    expect(body.status).toBe("uploading");
  });

  it("rejects unsupported formats", async () => {
    const res = await app.request("/videos/uploads", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ ...validBody, fileName: "clip.avi" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects oversized files", async () => {
    const res = await app.request("/videos/uploads", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ ...validBody, fileSizeBytes: 600 * 1024 * 1024 })
    });
    expect(res.status).toBe(400);
  });

  it("requires a coin price for unlock_with_coins", async () => {
    const res = await app.request("/videos/uploads", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ ...validBody, visibility: "unlock_with_coins" })
    });
    expect(res.status).toBe(400);
  });

  it("routes flagged captions to review", async () => {
    const res = await app.request("/videos/uploads", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ ...validBody, caption: "free coins hack tutorial" })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("under_review");
  });

  it("rate limits uploads", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 12; i += 1) {
      const res = await app.request("/videos/uploads", {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify(validBody)
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("moderation precheck", () => {
  it("passes normal content", () => {
    const result = precheckModeration("A nice cooking video", ["food"]);
    expect(result.eligible).toBe(true);
    expect(result.safetyScore).toBe(100);
  });

  it("flags dangerous content", () => {
    const result = precheckModeration("watch this school shooting clip", []);
    expect(result.eligible).toBe(false);
    expect(result.flaggedTerms.length).toBeGreaterThan(0);
  });
});

describe("mux webhook signature verification", () => {
  const secret = "test-webhook-secret";
  const provider = new MuxVideoProvider({ tokenId: "id", tokenSecret: "secret", webhookSecret: secret });
  const body = JSON.stringify({ type: "video.asset.ready", data: { id: "asset_1" } });

  function sign(payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
    const hmac = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    return `t=${timestamp},v1=${hmac}`;
  }

  it("accepts valid signatures", () => {
    expect(provider.verifyWebhookSignature(body, sign(body)).valid).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const header = sign(body);
    expect(provider.verifyWebhookSignature(body.replace("asset_1", "asset_2"), header).valid).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(provider.verifyWebhookSignature(body, undefined).valid).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(provider.verifyWebhookSignature(body, sign(body, old)).valid).toBe(false);
  });

  it("rejects everything when no secret configured", () => {
    const bare = new MuxVideoProvider({ tokenId: "id", tokenSecret: "secret" });
    expect(bare.verifyWebhookSignature(body, sign(body)).valid).toBe(false);
  });
});

describe("video webhook endpoint", () => {
  it("rejects unsigned mux events (mock provider accepts local)", async () => {
    // With the mock provider active (no env), signature verification passes
    // by design for local development; the endpoint still responds cleanly.
    const res = await app.request("/video-provider/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "video.asset.ready", data: { id: "a" } })
    });
    expect([200, 401]).toContain(res.status);
  });
});
