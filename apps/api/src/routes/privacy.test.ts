import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer user", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("privacy requests", () => {
  it("requires auth", async () => {
    const res = await app.request("/privacy/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "export" })
    });
    expect(res.status).toBe(401);
  });

  it("accepts export requests", async () => {
    const res = await app.request("/privacy/requests", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ type: "export" })
    });
    expect(res.status).toBe(201);
  });

  it("validates request types", async () => {
    const res = await app.request("/privacy/requests", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ type: "forget_me_entirely" })
    });
    expect(res.status).toBe(400);
  });

  it("lists own requests", async () => {
    const res = await app.request("/privacy/requests", { headers: userHeaders });
    expect(res.status).toBe(200);
  });
});

describe("account deletion", () => {
  it("requires auth to request deletion", async () => {
    const res = await app.request("/account/deletion", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("accepts deletion requests", async () => {
    const res = await app.request("/account/deletion", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ reason: "leaving" })
    });
    expect(res.status).toBe(201);
  });

  it("reports deletion status", async () => {
    const res = await app.request("/account/deletion", { headers: userHeaders });
    expect(res.status).toBe(200);
  });
});

describe("copyright claims", () => {
  it("validates claims", async () => {
    const res = await app.request("/copyright-claims", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ claimantName: "X" })
    });
    expect(res.status).toBe(400);
  });

  it("accepts complete claims", async () => {
    const res = await app.request("/copyright-claims", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        claimantName: "Northlight Records",
        claimantEmail: "legal@northlight.example",
        targetVideoId: "video_001",
        description: "The backing track is our copyrighted recording used without a license."
      })
    });
    expect(res.status).toBe(201);
  });
});

describe("support cases", () => {
  it("accepts support cases from users", async () => {
    const res = await app.request("/support-cases", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ subject: "Help", body: "My purchase did not arrive." })
    });
    expect(res.status).toBe(201);
  });
});

describe("feed sessions & impressions", () => {
  it("starts a session", async () => {
    const res = await app.request("/feed/session/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feedType: "for_you" })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { sessionId: string };
    expect(body.sessionId.length).toBeGreaterThan(0);
  });

  it("accepts batched impressions", async () => {
    const res = await app.request("/feed/impression", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        impressions: [
          { videoId: "video_001", watchedMs: 12000, completed: false },
          { adCreativeId: "adcr_001", watchedMs: 3000 }
        ]
      })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { recorded: number };
    expect(body.recorded).toBe(2);
  });

  it("rejects impressions without a target", async () => {
    const res = await app.request("/feed/impression", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ impressions: [{ watchedMs: 100 }] })
    });
    expect(res.status).toBe(400);
  });
});
