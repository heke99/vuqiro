import { Hono } from "hono";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser } from "../middleware/auth";

export const feedRoutes = new Hono<AppEnv>();

feedRoutes.use("*", attachUser);

export type FeedItemDto = {
  id: string;
  creatorId: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorVerified: boolean;
  caption: string;
  hashtags: string[];
  category?: string;
  visibility: string;
  moderationStatus: string;
  coinUnlockPrice?: number;
  requiredTier?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  watchCount: number;
  isPremium: boolean;
  createdAt?: string;
};

function mockFeed(): FeedItemDto[] {
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
      // Locked content never exposes its playback URL to the client.
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

type VideoRow = {
  id: string;
  creator_id: string;
  caption: string;
  hashtags: string[];
  category: string | null;
  visibility: string;
  moderation_status: string;
  coin_unlock_price: number | null;
  required_tier: string | null;
  playback_url: string | null;
  thumbnail_url: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  watch_count: number;
  created_at: string;
  creators: {
    id: string;
    profile_id: string;
    verification_status: string;
    profiles: { handle: string; display_name: string } | null;
  } | null;
};

function toDto(row: VideoRow): FeedItemDto {
  const locked = row.visibility !== "public";
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorHandle: row.creators?.profiles?.handle ?? "unknown",
    creatorDisplayName: row.creators?.profiles?.display_name ?? "Unknown",
    creatorVerified: row.creators?.verification_status === "verified",
    caption: row.caption,
    hashtags: row.hashtags,
    category: row.category ?? undefined,
    visibility: row.visibility,
    moderationStatus: row.moderation_status,
    coinUnlockPrice: row.coin_unlock_price ?? undefined,
    requiredTier: row.required_tier ?? undefined,
    playbackUrl: locked ? undefined : (row.playback_url ?? undefined),
    thumbnailUrl: row.thumbnail_url ?? undefined,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    watchCount: Number(row.watch_count),
    isPremium: locked,
    createdAt: row.created_at
  };
}

const VIDEO_SELECT =
  "id, creator_id, caption, hashtags, category, visibility, moderation_status, coin_unlock_price, required_tier, playback_url, thumbnail_url, like_count, comment_count, share_count, watch_count, created_at, creators (id, profile_id, verification_status, profiles (handle, display_name))";

async function blockedCreatorIds(profileId: string | undefined): Promise<Set<string>> {
  const db = getServiceDb();
  if (!db || !profileId) return new Set();
  const { data } = await db.from("blocks").select("blocked_profile_id").eq("blocker_id", profileId);
  if (!data || data.length === 0) return new Set();
  const blockedProfiles = data.map((row) => row.blocked_profile_id);
  const { data: creators } = await db.from("creators").select("id").in("profile_id", blockedProfiles);
  return new Set((creators ?? []).map((row) => row.id));
}

feedRoutes.get("/for-you", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ items: mockFeed(), source: "mock" });
  }
  const db = getServiceDb()!;
  const profile = c.get("profile");
  const blocked = await blockedCreatorIds(profile?.id);

  const { data, error } = await db
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("status", "ready")
    .in("moderation_status", ["visible", "limited", "age_restricted"])
    .neq("visibility", "private")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return c.json({ error: error.message }, 500);

  const items = (data as unknown as VideoRow[]).filter((row) => !blocked.has(row.creator_id)).map(toDto);
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
  const { data, error } = await db
    .from("videos")
    .select(VIDEO_SELECT)
    .in("creator_id", creatorIds)
    .eq("status", "ready")
    .in("moderation_status", ["visible", "limited", "age_restricted"])
    .neq("visibility", "private")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return c.json({ error: error.message }, 500);

  const items = (data as unknown as VideoRow[]).filter((row) => !blocked.has(row.creator_id)).map(toDto);
  return c.json({ items, source: "db" });
});
