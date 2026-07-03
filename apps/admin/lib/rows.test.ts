import { describe, expect, it } from "vitest";
import { field, fieldDate, fieldNum, fieldStr, usd } from "./rows";

describe("row field helpers", () => {
  it("returns the first defined key (snake_case or camelCase)", () => {
    expect(field({ created_at: "a" }, "created_at", "createdAt")).toBe("a");
    expect(field({ createdAt: "b" }, "created_at", "createdAt")).toBe("b");
    expect(field({}, "created_at", "createdAt")).toBeUndefined();
  });

  it("stringifies safely", () => {
    expect(fieldStr({ handle: "maya" }, "handle")).toBe("maya");
    expect(fieldStr({}, "handle")).toBe("");
  });

  it("parses numbers with fallback", () => {
    expect(fieldNum({ like_count: 12 }, "like_count", "likeCount")).toBe(12);
    expect(fieldNum({ likeCount: "34" }, "like_count", "likeCount")).toBe(34);
    expect(fieldNum({}, "like_count")).toBe(0);
  });

  it("formats dates and tolerates garbage", () => {
    expect(fieldDate({ created_at: "2026-07-01T00:00:00Z" }, "created_at")).not.toBe("—");
    expect(fieldDate({ created_at: "not-a-date" }, "created_at")).toBe("—");
    expect(fieldDate({}, "created_at")).toBe("—");
  });

  it("formats cents as USD", () => {
    expect(usd(500000)).toBe("$5,000.00");
    expect(usd(43250)).toBe("$432.50");
  });
});
