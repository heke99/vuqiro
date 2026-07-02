import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("legal endpoints", () => {
  it("serves published documents without auth", async () => {
    const res = await app.request("/legal/documents");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { documents: { type: string; status: string }[] };
    expect(body.documents.length).toBeGreaterThan(0);
    for (const doc of body.documents) {
      expect(doc.status).toBe("published");
    }
  });

  it("requires auth to accept", async () => {
    const res = await app.request("/legal/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentTypes: ["terms"] })
    });
    expect(res.status).toBe(401);
  });

  it("validates document types", async () => {
    const res = await app.request("/legal/accept", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ documentTypes: ["eula_of_doom"] })
    });
    expect(res.status).toBe(400);
  });

  it("records acceptances", async () => {
    const res = await app.request("/legal/accept", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ documentTypes: ["terms", "privacy", "community_guidelines"] })
    });
    expect(res.status).toBe(201);
  });

  it("serves the caller's acceptance history", async () => {
    const res = await app.request("/legal/acceptances", { headers: userHeaders });
    expect(res.status).toBe(200);
  });
});
