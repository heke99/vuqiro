import { Hono } from "hono";
import { z } from "zod";
import { mockCreators, mockFollows, mockVideos } from "@vuqiro/mock-data";
import type { ServedAd } from "@vuqiro/types";
import { selectAds, type AdViewer } from "../lib/adServing";
import {
  applyFeedRules,
  filterViewableRows,
  hiddenCreatorIds,
  notInterestedVideoIds,
  toFeedDto,
  visibleVideosQuery,
  type FeedItemDto,
  type VideoRow
} from "../lib/feedQuery";
import { badRequest } from "../lib/errors";
import { DEFAULT_FEED_SETTINGS, getPlatformSetting, type FeedSettings } from "../lib/platformSettings";
import { rankFeedRows } from "../lib/feedRanking";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import { getVisibleVideosForViewer, loadViewerContext, type ViewerContext } from "../lib/videoAccess";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const feedRoutes = new Hono<AppEnv>();

feedRoutes.use("*", attachUser);

export type FeedEntry = ({ kind: "video" } & FeedItemDto) | ServedAd;

/**
 * Cursor helpers: the cursor is the createdAt|id pair of the last organic
 * item, base64-encoded so it round-trips URLs safely.
 */
function encodeCursor(row: { createdAt?: string; id: string }): string {
  return Buffer.from(`${row.createdAt ?? ""}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor: string | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

async function buildAdViewer(profileId: string | undefined, sessionId: string | undefined): Promise<AdViewer> {
  if (!profileId || !isBackendConfigured()) {
    return { profileId, anonSessionId: sessionId, personalizedAdsOptIn: false };
  }
  const db = getServiceDb()!;
  const [{ data: settings }, { data: interests }, { data: profileRow }] = await Promise.all([
    db.from("profile_settings").select("personalized_ads_opt_in").eq("profile_id", profileId).maybeSingle(),
    db.from("user_interests").select("interest").eq("profile_id", profileId),
    db.from("profiles").select("country, language").eq("id", profileId).maybeSingle()
  ]);
  return {
    profileId,
    anonSessionId: sessionId,
    country: profileRow?.country ?? undefined,
    language: profileRow?.language ?? undefined,
    interests: (interests ?? []).map((row) => row.interest),
    personalizedAdsOptIn: settings?.personalized_ads_opt_in ?? false
  };
}

/** Interleave served ads after every `frequency` organic videos. */
export function insertAds(videos: FeedItemDto[], ads: ServedAd[], frequency: number): FeedEntry[] {
  const entries: FeedEntry[] = [];
  let adIndex = 0;
  videos.forEach((video, index) => {
    entries.push({ kind: "video", ...video });
    if (frequency > 0 && (index + 1) % frequency === 0 && adIndex < ads.length) {
      entries.push(ads[adIndex]);
      adIndex += 1;
    }
  });
  return entries;
}

/** Marks organic items whose reach is paid (active boost) so clients can
 * render the required "Promoted" disclosure label. */
async function markPromoted(page: FeedItemDto[]): Promise<void> {
  if (page.length === 0 || !isBackendConfigured()) return;
  const db = getServiceDb()!;
  const { data } = await db
    .from("boost_campaigns")
    .select("video_id")
    .in("video_id", page.map((item) => item.id))
    .eq("status", "active");
  const boosted = new Set((data ?? []).map((row) => row.video_id));
  for (const item of page) {
    if (boosted.has(item.id)) item.promoted = true;
  }
}

async function paginatedFeedResponse(options: {
  profileId: string | undefined;
  sessionId: string | undefined;
  cursor: string | undefined;
  rows: VideoRow[];
  pageSize: number;
  withAds: boolean;
  feedSettings: FeedSettings;
}): Promise<{ items: FeedEntry[]; nextCursor: string | null }> {
  const page = options.rows.slice(0, options.pageSize).map(toFeedDto);
  await markPromoted(page);
  const nextCursor =
    options.rows.length > options.pageSize && page.length > 0 ? encodeCursor(page[page.length - 1]) : null;

  let ads: ServedAd[] = [];
  if (options.withAds && options.feedSettings.adFrequency > 0) {
    const adCount = Math.min(
      Math.floor(page.length / options.feedSettings.adFrequency),
      options.feedSettings.maxAdsPerPage
    );
    if (adCount > 0) {
      const viewer = await buildAdViewer(options.profileId, options.sessionId);
      ads = await selectAds(viewer, "feed", adCount);
    }
  }
  return { items: insertAds(page, ads, options.feedSettings.adFrequency), nextCursor };
}

export function mockFeed(viewer?: ViewerContext): FeedItemDto[] {
  const videos = viewer ? getVisibleVideosForViewer(viewer, mockVideos) : mockVideos;
  return videos.map((video) => {
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
      isPremium: video.visibility !== "public",
      createdAt: video.createdAt
    };
  });
}

feedRoutes.get("/for-you", async (c) => {
  const cursor = decodeCursor(c.req.query("cursor"));
  const sessionId = c.req.query("session") ?? undefined;
  const feedSettings = await getPlatformSetting("feed", DEFAULT_FEED_SETTINGS);
  const profile = c.get("profile");
  // Per-viewer access filter runs BEFORE ranking on every surface.
  const viewer = await loadViewerContext(profile?.id);

  if (!isBackendConfigured()) {
    // Mock mode paginates the deterministic mock feed and inserts mock ads.
    const all = mockFeed(viewer);
    const start = cursor ? all.findIndex((item) => item.id === cursor.id) + 1 : 0;
    const page = all.slice(start, start + feedSettings.pageSize);
    const ads = await selectAds({ personalizedAdsOptIn: false }, "feed", feedSettings.maxAdsPerPage);
    const items = insertAds(page, ads, feedSettings.adFrequency);
    const nextCursor =
      start + feedSettings.pageSize < all.length && page.length > 0
        ? encodeCursor(page[page.length - 1])
        : null;
    return c.json({ items, nextCursor, source: "mock" });
  }

  const [hidden, notInterested] = await Promise.all([
    hiddenCreatorIds(profile?.id),
    notInterestedVideoIds(profile?.id)
  ]);

  let query = visibleVideosQuery().order("created_at", { ascending: false }).limit(100);
  if (cursor) query = query.lt("created_at", cursor.createdAt);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);

  const visible = filterViewableRows(
    viewer,
    applyFeedRules(data as unknown as VideoRow[], hidden).filter((row) => !notInterested.has(row.id))
  );
  const ranked = await rankFeedRows(visible, profile?.id);
  const { items, nextCursor } = await paginatedFeedResponse({
    profileId: profile?.id,
    sessionId,
    cursor: c.req.query("cursor"),
    rows: ranked,
    pageSize: feedSettings.pageSize,
    withAds: true,
    feedSettings
  });
  return c.json({ items, nextCursor, source: "db" });
});

/**
 * Trending: highest engagement over the recent window. Trending is a fully
 * public surface, so only public videos may appear (matching the trend
 * snapshot job in lib/trending.ts).
 */
feedRoutes.get("/trending", async (c) => {
  const feedSettings = await getPlatformSetting("feed", DEFAULT_FEED_SETTINGS);
  if (!isBackendConfigured()) {
    const items = mockFeed()
      .filter((item) => item.visibility === "public")
      .sort((a, b) => b.watchCount - a.watchCount)
      .slice(0, feedSettings.pageSize)
      .map((item) => ({ kind: "video" as const, ...item }));
    return c.json({ items, nextCursor: null, source: "mock" });
  }
  const profile = c.get("profile");
  const blocked = await hiddenCreatorIds(profile?.id);
  const { data, error } = await visibleVideosQuery()
    .eq("visibility", "public")
    .order("watch_count", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);
  const items = applyFeedRules(data as unknown as VideoRow[], blocked)
    .slice(0, feedSettings.pageSize * 2)
    .map((row) => ({ kind: "video" as const, ...toFeedDto(row) }));
  return c.json({ items, nextCursor: null, source: "db" });
});

/** Videos using a specific sound. */
feedRoutes.get("/sound/:id", async (c) => {
  const soundId = z.string().min(1).parse(c.req.param("id"));
  if (!isBackendConfigured()) {
    return c.json({ items: [], soundId, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: links, error } = await db.from("video_sounds").select("video_id").eq("sound_id", soundId).limit(100);
  if (error) throw badRequest(error.message);
  const videoIds = (links ?? []).map((row) => row.video_id);
  if (videoIds.length === 0) return c.json({ items: [], soundId, source: "db" });

  const profile = c.get("profile");
  const [viewer, blocked] = await Promise.all([loadViewerContext(profile?.id), hiddenCreatorIds(profile?.id)]);
  const { data } = await visibleVideosQuery().in("id", videoIds).order("watch_count", { ascending: false }).limit(50);
  const items = filterViewableRows(viewer, applyFeedRules((data ?? []) as unknown as VideoRow[], blocked)).map(
    (row) => ({
      kind: "video" as const,
      ...toFeedDto(row)
    })
  );
  return c.json({ items, soundId, source: "db" });
});

feedRoutes.get("/following", async (c) => {
  const profile = c.get("profile");
  if (!isBackendConfigured()) {
    if (!profile) return c.json({ items: [], source: "mock" });
    const viewer = await loadViewerContext(profile.id);
    const followed = new Set(
      mockFollows.filter((follow) => follow.userId === profile.id).map((follow) => follow.creatorId)
    );
    const items = mockFeed(viewer).filter((item) => followed.has(item.creatorId));
    return c.json({ items, source: "mock" });
  }
  const db = getServiceDb()!;
  if (!profile) return c.json({ items: [], source: "db" });

  const { data: follows } = await db.from("follows").select("creator_id").eq("follower_id", profile.id);
  const creatorIds = (follows ?? []).map((row) => row.creator_id);
  if (creatorIds.length === 0) return c.json({ items: [], source: "db" });

  const [viewer, blocked] = await Promise.all([loadViewerContext(profile.id), hiddenCreatorIds(profile.id)]);
  const { data, error } = await visibleVideosQuery()
    .in("creator_id", creatorIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);

  const items = filterViewableRows(viewer, applyFeedRules(data as unknown as VideoRow[], blocked)).map(toFeedDto);
  return c.json({ items, source: "db" });
});

feedRoutes.get("/hashtag/:tag", async (c) => {
  const tag = z
    .string()
    .min(1)
    .max(40)
    .transform((value) => value.toLowerCase().replace(/^#/, ""))
    .parse(c.req.param("tag"));
  const profile = c.get("profile");
  const viewer = await loadViewerContext(profile?.id);

  if (!isBackendConfigured()) {
    const items = mockFeed(viewer).filter((item) => item.hashtags.includes(tag));
    return c.json({ items, tag, source: "mock" });
  }

  const blocked = await hiddenCreatorIds(profile?.id);
  const { data, error } = await visibleVideosQuery()
    .contains("hashtags", [tag])
    .order("watch_count", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);

  const items = filterViewableRows(viewer, applyFeedRules(data as unknown as VideoRow[], blocked)).map(toFeedDto);
  return c.json({ items, tag, source: "db" });
});

/**
 * The member ("exclusive") feed: gated videos from creators the caller has
 * access to — via membership, coin unlocks, grants or ownership. Requires
 * auth; this is never a browse-everyone's-locked-content surface, and it
 * never exposes playback URLs (playback goes through /videos/:id/access).
 */
feedRoutes.get("/premium", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const viewer = await loadViewerContext(profile.id);

  if (!isBackendConfigured()) {
    const items = mockFeed(viewer).filter((item) => item.visibility !== "public");
    return c.json({ items, source: "mock" });
  }

  const blocked = await hiddenCreatorIds(profile.id);
  const { data, error } = await visibleVideosQuery()
    .in("visibility", ["subscribers_only", "premium_tier_only", "unlock_with_coins", "followers_only"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);

  const items = filterViewableRows(viewer, applyFeedRules(data as unknown as VideoRow[], blocked)).map(toFeedDto);
  return c.json({ items, source: "db" });
});
