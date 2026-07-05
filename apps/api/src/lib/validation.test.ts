import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "./validation";
import { createApp } from "../app";

describe("safeHttpUrl", () => {
  it("accepts https URLs", () => {
    expect(safeHttpUrl.safeParse("https://example.com/page?q=1").success).toBe(true);
  });

  it("accepts http only for localhost (development)", () => {
    expect(safeHttpUrl.safeParse("http://localhost:3000/x").success).toBe(true);
    expect(safeHttpUrl.safeParse("http://example.com").success).toBe(false);
  });

  it("rejects javascript:, data: and other schemes", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<script>1</script>", "ftp://example.com", "not a url"]) {
      expect(safeHttpUrl.safeParse(url).success).toBe(false);
    }
  });
});

describe("URL validation at the API boundary", () => {
  const app = createApp();

  it("rejects ad creatives with unsafe CTA URLs", async () => {
    const res = await app.request("/admin/ads/creatives", {
      method: "POST",
      headers: { authorization: "Bearer admin", "content-type": "application/json" },
      body: JSON.stringify({
        adGroupId: "grp_1",
        campaignId: "camp_1",
        title: "Bad ad",
        ctaUrl: "javascript:alert(1)"
      })
    });
    expect(res.status).toBe(400);
  });

  it("rejects profile links with unsafe schemes", async () => {
    const res = await app.request("/me", {
      method: "PATCH",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ websiteUrl: "javascript:alert(1)" })
    });
    expect(res.status).toBe(400);
  });

  it("still accepts https profile links", async () => {
    const res = await app.request("/me", {
      method: "PATCH",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ websiteUrl: "https://example.com" })
    });
    expect(res.status).toBe(200);
  });
});
