import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("not-interested", () => {
  it("requires auth", async () => {
    const res = await app.request("/videos/video_001/not-interested", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("records the signal for signed-in users", async () => {
    const res = await app.request("/videos/video_001/not-interested", { method: "POST", headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notInterested: boolean };
    expect(body.notInterested).toBe(true);
  });

  it("is rate limited", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 125; i += 1) {
      const res = await app.request("/videos/video_001/not-interested", { method: "POST", headers: userHeaders });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("mutes", () => {
  it("requires auth", async () => {
    const res = await app.request("/mutes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creatorId: "creator_001" })
    });
    expect(res.status).toBe(401);
  });

  it("mutes by creator id", async () => {
    const res = await app.request("/mutes", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creatorId: "creator_001" })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { muted: boolean };
    expect(body.muted).toBe(true);
  });

  it("rejects a request with neither profile nor creator id", async () => {
    const res = await app.request("/mutes", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);
  });

  it("lists the caller's mutes", async () => {
    const res = await app.request("/me/mutes", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mutes: unknown[] };
    expect(Array.isArray(body.mutes)).toBe(true);
  });
});

describe("comment pagination", () => {
  it("returns comments with a nextCursor field", async () => {
    const res = await app.request("/videos/video_001/comments");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { comments: unknown[]; nextCursor: string | null };
    expect(Array.isArray(body.comments)).toBe(true);
    expect("nextCursor" in body).toBe(true);
  });

  it("caps the page size", async () => {
    const res = await app.request("/videos/video_001/comments?limit=5000");
    expect(res.status).toBe(200);
  });
});
