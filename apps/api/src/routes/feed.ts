import { Hono } from "hono";
import { z } from "zod";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import {
  applyFeedRules,
  blockedCreatorIds,
  toFeedDto,
  visibleVideosQuery,
  type FeedItemDto,
  type VideoRow
} from "../lib/feedQuery";
import { badRequest } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser } from "../middleware/auth";

export const feedRoutes = new Hono<AppEnv>();

feedRoutes.use("*", attachUser);

export function mockFeed(): FeedItemDto[] {
  return mockVideos.map((video) => {
    const creator = mockCreators.find((candidate) => candidate.id === video.creatorId);
    return {
      id: video.id,
      creatorId: video.creatorId,
      creatorHandle: creator?.handle ?? "unknown",
      creatorDisplayName: creator?.displayName ?? "Unknown",
      creatorVerified: creator?.isVerified ?? false,
      caption: video.caption,
      hashtags: video.hashtags,
      category: video.category,
      visibility: video.visibility,
      moderationStatus: video.moderationStatus ?? "visible",
      coinUnlockPrice: video.coinUnlockPrice,
      requiredTier: video.requiredTier,
      playbackUrl: video.visibility === "public" ? video.playbackUrl : undefined,
      thumbnailUrl: video.thumbnailUrl,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      watchCount: video.watchCount,
      isPremium: video.isPremium,
      createdAt: video.createdAt
    };
  });
}

feedRoutes.get("/for-you", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ items: mockFeed(), source: "mock" });
  }
  const profile = c.get("profile");
  const blocked = await blockedCreatorIds(profile?.id);

  const { data, error } = await visibleVideosQuery().order("created_at", { ascending: false }).limit(50);
  if (error) throw badRequest(error.message);

  const items = applyFeedRules(data as unknown as VideoRow[], blocked).map(toFeedDto);
  return c.json({ items, source: "db" });
});

feedRoutes.get("/following", async (c) => {
  if (!isBackendConfigured()) {
    const items = mockFeed().filter((item) => item.creatorVerified);
    return c.json({ items, source: "mock" });
  }
  const db = getServiceDb()!;
  const profile = c.get("profile");
  if (!profile) return c.json({ items: [], source: "db" });

  const { data: follows } = await db.from("follows").select("creator_id").eq("follower_id", profile.id);
  const creatorIds = (follows ?? []).map((row) => row.creator_id);
  if (creatorIds.length === 0) return c.json({ items: [], source: "db" });

  const blocked = await blockedCreatorIds(profile.id);
  const { data, error } = await visibleVideosQuery()
    .in("creator_id", creatorIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);

  const items = applyFeedRules(data as unknown as VideoRow[], blocked).map(toFeedDto);
  return c.json({ items, source: "db" });
});

feedRoutes.get("/hashtag/:tag", async (c) => {
  const tag = z
    .string()
    .min(1)
    .max(40)
    .transform((value) => value.toLowerCase().replace(/^#/, ""))
    .parse(c.req.param("tag"));

  if (!isBackendConfigured()) {
    const items = mockFeed().filter((item) => item.hashtags.includes(tag));
    return c.json({ items, tag, source: "mock" });
  }

  const profile = c.get("profile");
  const blocked = await blockedCreatorIds(profile?.id);
  const { data, error } = await visibleVideosQuery()
    .contains("hashtags", [tag])
    .order("watch_count", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);

  const items = applyFeedRules(data as unknown as VideoRow[], blocked).map(toFeedDto);
  return c.json({ items, tag, source: "db" });
});

feedRoutes.get("/premium", async (c) => {
  if (!isBackendConfigured()) {
    const items = mockFeed().filter((item) => item.isPremium);
    return c.json({ items, source: "mock" });
  }

  const profile = c.get("profile");
  const blocked = await blockedCreatorIds(profile?.id);
  const { data, error } = await visibleVideosQuery()
    .in("visibility", ["subscribers_only", "premium_tier_only", "unlock_with_coins"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);

  const items = applyFeedRules(data as unknown as VideoRow[], blocked).map(toFeedDto);
  return c.json({ items, source: "db" });
});
