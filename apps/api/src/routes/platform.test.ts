import { describe, expect, it } from "vitest";
import { createApp } from "../app";

const app = createApp();

describe("public feature flags", () => {
  it("serves client-safe flags without auth", async () => {
    const res = await app.request("/feature-flags");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { flags: { key: string; enabled: boolean }[]; source: string };
    expect(body.flags.length).toBeGreaterThan(0);
    for (const flag of body.flags) {
      expect(Object.keys(flag).sort()).toEqual(["enabled", "key"]);
      expect(typeof flag.key).toBe("string");
      expect(typeof flag.enabled).toBe("boolean");
    }
  });

  it("filters flags to the current environment", async () => {
    // Test env: "all" + "development" flags apply; production-only flags do not.
    const res = await app.request("/feature-flags");
    const body = (await res.json()) as { flags: { key: string }[] };
    const keys = body.flags.map((flag) => flag.key);
    expect(keys).toContain("coin_tips");
    expect(keys).not.toContain("boost_purchases");
  });
});
