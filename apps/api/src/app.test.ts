import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("api app", () => {
  it("responds on /health", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("vuqiro-api");
  });
});
