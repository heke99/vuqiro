import { describe, expect, it, vi } from "vitest";

// The API client transitively imports the Supabase RN client; mock it so the
// pure feed mapping logic is testable in Node.
vi.mock("../api/client", () => ({
  isApiConfigured: () => false,
  apiFetch: vi.fn()
}));

const { mockFeedEntries } = await import("./feedData");

describe("mockFeedEntries", () => {
  it("interleaves sponsored entries between videos", () => {
    const entries = mockFeedEntries();
    const ads = entries.filter((entry) => entry.kind === "ad");
    const videos = entries.filter((entry) => entry.kind === "video");
    expect(videos.length).toBeGreaterThan(10);
    expect(ads.length).toBeGreaterThan(0);
    // Roughly one ad per 6 videos.
    expect(ads.length).toBe(Math.floor(videos.length / 6));
  });

  it("labels ads with advertiser and CTA", () => {
    const ad = mockFeedEntries().find((entry) => entry.kind === "ad");
    expect(ad).toBeDefined();
    if (ad?.kind === "ad") {
      expect(ad.ad.advertiserName.length).toBeGreaterThan(0);
      expect(ad.ad.ctaUrl).toMatch(/^https?:/);
      expect(ad.ad.kind).toBe("ad");
    }
  });

  it("pairs every video with its creator", () => {
    for (const entry of mockFeedEntries()) {
      if (entry.kind === "video") {
        expect(entry.creator.id.length).toBeGreaterThan(0);
        expect(entry.video.creatorId.length).toBeGreaterThan(0);
      }
    }
  });
});
