import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("messaging", () => {
  it("requires auth everywhere", async () => {
    const paths: [string, string][] = [
      ["GET", "/messages/conversations"],
      ["POST", "/messages/conversations"],
      ["GET", "/messages/conversations/conv_1"],
      ["POST", "/messages/conversations/conv_1"],
      ["POST", "/messages/conversations/conv_1/read"]
    ];
    for (const [method, path] of paths) {
      const res = await app.request(path, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ body: "hi", creatorId: "creator_001" }) : undefined
      });
      expect(res.status).toBe(401);
    }
  });

  it("lists conversations for signed-in users", async () => {
    const res = await app.request("/messages/conversations", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { conversations: unknown[] };
    expect(Array.isArray(body.conversations)).toBe(true);
  });

  it("opens a conversation by creator id", async () => {
    const res = await app.request("/messages/conversations", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creatorId: "creator_001" })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { conversationId: string };
    expect(body.conversationId.length).toBeGreaterThan(0);
  });

  it("rejects opening a conversation without a recipient", async () => {
    const res = await app.request("/messages/conversations", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);
  });

  it("validates message bodies", async () => {
    const res = await app.request("/messages/conversations/conv_1", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ body: "" })
    });
    expect(res.status).toBe(400);
  });

  it("rate limits sends", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 65; i += 1) {
      const res = await app.request("/messages/conversations/conv_1", {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify({ body: "hello" })
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("accepts message reports", async () => {
    const res = await app.request("/reports", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ targetType: "message", targetId: "msg_001", reason: "harassment" })
    });
    expect(res.status).toBe(201);
  });
});
