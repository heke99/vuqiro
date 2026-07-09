import { beforeEach, describe, expect, it } from "vitest";
import { applyFeedRules, type VideoRow } from "../lib/feedQuery";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();

beforeEach(() => resetRateLimits());

function makeRow(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    id: "v1",
    creator_id: "c1",
    caption: "test",
    hashtags: [],
    category: null,
    visibility: "public",
    moderation_status: "visible",
    coin_unlock_price: null,
    required_tier: null,
    playback_url: "https://example.com/v.m3u8",
    thumbnail_url: null,
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    watch_count: 0,
    created_at: new Date().toISOString(),
    creators: {
      id: "c1",
      profile_id: "p1",
      verification_status: "verified",
      profiles: { handle: "h", display_name: "H", status: "active" }
    },
    ...overrides
  };
}

describe("feed visibility rules", () => {
  it("hides blocked creators", () => {
    const rows = [makeRow(), makeRow({ id: "v2", creator_id: "c2" })];
    const result = applyFeedRules(rows, new Set(["c2"]));
    expect(result.map((row) => row.id)).toEqual(["v1"]);
  });

  it("hides banned and suspended creators", () => {
    const rows = [
      makeRow(),
      makeRow({
        id: "v2",
        creators: { id: "c2", profile_id: "p2", verification_status: "verified", profiles: { handle: "x", display_name: "X", status: "banned" } }
      }),
      makeRow({
        id: "v3",
        creators: { id: "c3", profile_id: "p3", verification_status: "verified", profiles: { handle: "y", display_name: "Y", status: "suspended" } }
      })
    ];
    const result = applyFeedRules(rows, new Set());
    expect(result.map((row) => row.id)).toEqual(["v1"]);
  });
});

describe("discovery endpoints (mock mode)", () => {
  it("searches creators, videos and hashtags", async () => {
    const res = await app.request("/search?q=music");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { creators: unknown[]; videos: unknown[]; hashtags: string[] };
    expect(body.videos.length).toBeGreaterThan(0);
    expect(body.hashtags).toContain("music");
  });

  it("rejects empty queries", async () => {
    const res = await app.request("/search?q=");
    expect(res.status).toBe(400);
  });

  it("returns trending data", async () => {
    const res = await app.request("/discover/trending");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      trendingCreators: unknown[];
      trendingHashtags: string[];
      topVideos: unknown[];
      premiumCreators: unknown[];
      newCreators: unknown[];
    };
    expect(body.trendingCreators.length).toBeGreaterThan(0);
    expect(body.trendingHashtags.length).toBeGreaterThan(0);
    expect(body.topVideos.length).toBeGreaterThan(0);
  });

  it("returns hashtag feeds", async () => {
    const res = await app.request("/feed/hashtag/music");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { hashtags: string[] }[] };
    for (const item of body.items) {
      expect(item.hashtags).toContain("music");
    }
  });

  it("requires auth for the premium (member) feed", async () => {
    const res = await app.request("/feed/premium");
    expect(res.status).toBe(401);
  });

  it("returns only the caller's accessible locked items in the premium feed", async () => {
    // user_me has memberships for creator_001/004/007 and three coin unlocks.
    const res = await app.request("/feed/premium", {
      headers: { authorization: "Bearer token", "x-mock-user": "user_me" }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string; creatorId: string; isPremium: boolean; playbackUrl?: string }[];
    };
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.isPremium).toBe(true);
      // Playback for gated content only ever comes from /videos/:id/access.
      expect(item.playbackUrl).toBeUndefined();
    }
    // Creator_005's subscribers-only video must not appear (no membership).
    expect(body.items.map((item) => item.id)).not.toContain("video_007");
  });

  it("returns creator storefront videos", async () => {
    const res = await app.request("/creators/creator_001/videos");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items.length).toBeGreaterThan(0);
  });
});

describe("event ingestion", () => {
  it("accepts valid event batches", async () => {
    const res = await app.request("/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [{ name: "video_impression", videoId: "video_001" }] })
    });
    expect(res.status).toBe(202);
  });

  it("rejects unknown event names", async () => {
    const res = await app.request("/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [{ name: "not_an_event" }] })
    });
    expect(res.status).toBe(400);
  });

  it("rejects oversized batches", async () => {
    const events = Array.from({ length: 101 }, () => ({ name: "feed_view" }));
    const res = await app.request("/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events })
    });
    expect(res.status).toBe(400);
  });
});
