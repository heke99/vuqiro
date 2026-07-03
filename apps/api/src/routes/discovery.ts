import { Hono } from "hono";
import { z } from "zod";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import {
  applyFeedRules,
  blockedCreatorIds,
  toFeedDto,
  visibleVideosQuery,
  type VideoRow
} from "../lib/feedQuery";
import { badRequest } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser } from "../middleware/auth";

export const discoveryRoutes = new Hono<AppEnv>();

discoveryRoutes.use("*", attachUser);

type CreatorSummary = {
  id: string;
  handle: string;
  displayName: string;
  isVerified: boolean;
  category?: string;
  followerCount: number;
  subscriberCount: number;
  monetizationEnabled: boolean;
  createdAt?: string;
};

function mockCreatorSummaries(): CreatorSummary[] {
  return mockCreators.map((creator) => ({
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    isVerified: creator.isVerified,
    category: creator.category,
    followerCount: creator.followerCount,
    subscriberCount: creator.subscriberCount,
    monetizationEnabled: creator.monetizationEnabled ?? false,
    createdAt: creator.createdAt
  }));
}

async function dbCreatorSummaries(): Promise<CreatorSummary[]> {
  const db = getServiceDb()!;
  const { data } = await db
    .from("creators")
    .select("id, category, verification_status, monetization_enabled, created_at, profiles (handle, display_name, status)")
    .limit(200);
  const rows = (data ?? []) as unknown as {
    id: string;
    category: string | null;
    verification_status: string;
    monetization_enabled: boolean;
    created_at: string;
    profiles: { handle: string; display_name: string; status: string } | null;
  }[];

  const active = rows.filter((row) => row.profiles?.status === "active");
  const counts = await Promise.all(
    active.map(async (row) => {
      const [{ count: followers }, { count: subscribers }] = await Promise.all([
        db.from("follows").select("id", { count: "exact", head: true }).eq("creator_id", row.id),
        db
          .from("creator_memberships")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", row.id)
          .eq("status", "active")
      ]);
      return { followers: followers ?? 0, subscribers: subscribers ?? 0 };
    })
  );

  return active.map((row, index) => ({
    id: row.id,
    handle: row.profiles?.handle ?? "unknown",
    displayName: row.profiles?.display_name ?? "Unknown",
    isVerified: row.verification_status === "verified",
    category: row.category ?? undefined,
    followerCount: counts[index].followers,
    subscriberCount: counts[index].subscribers,
    monetizationEnabled: row.monetization_enabled,
    createdAt: row.created_at
  }));
}

/**
 * Search across creators, videos and hashtags. Only visible content and
 * active creators are searchable; the caller's blocked creators are removed.
 */
discoveryRoutes.get("/search", async (c) => {
  const query = z.string().trim().min(1).max(80).parse(c.req.query("q") ?? "");
  const term = query.toLowerCase().replace(/^#/, "");

  if (!isBackendConfigured()) {
    const creators = mockCreatorSummaries().filter(
      (creator) =>
        creator.handle.toLowerCase().includes(term) ||
        creator.displayName.toLowerCase().includes(term) ||
        (creator.category ?? "").toLowerCase().includes(term)
    );
    const videos = mockVideos.filter(
      (video) =>
        video.caption.toLowerCase().includes(term) ||
        video.hashtags.some((tag) => tag.includes(term)) ||
        (video.category ?? "").toLowerCase().includes(term)
    );
    const hashtags = [...new Set(mockVideos.flatMap((video) => video.hashtags))].filter((tag) =>
      tag.includes(term)
    );
    return c.json({ creators, videos, hashtags, source: "mock" });
  }

  const profile = c.get("profile");
  const blocked = await blockedCreatorIds(profile?.id);
  const db = getServiceDb()!;

  const [{ data: videoRows, error }, creators] = await Promise.all([
    visibleVideosQuery().ilike("caption", `%${term}%`).limit(25),
    dbCreatorSummaries()
  ]);
  if (error) throw badRequest(error.message);

  const { data: tagRows } = await db
    .from("videos")
    .select("hashtags")
    .eq("status", "ready")
    .in("moderation_status", ["visible", "limited"])
    .limit(500);
  const hashtags = [...new Set((tagRows ?? []).flatMap((row) => row.hashtags as string[]))].filter((tag) =>
    tag.includes(term)
  );

  const { data: tagVideoRows } = await visibleVideosQuery().contains("hashtags", [term]).limit(25);

  const videoItems = applyFeedRules(
    [...((videoRows ?? []) as unknown as VideoRow[]), ...((tagVideoRows ?? []) as unknown as VideoRow[])],
    blocked
  );
  const uniqueVideos = [...new Map(videoItems.map((row) => [row.id, row])).values()].map(toFeedDto);

  const matchingCreators = creators.filter(
    (creator) =>
      !blocked.has(creator.id) &&
      (creator.handle.toLowerCase().includes(term) ||
        creator.displayName.toLowerCase().includes(term) ||
        (creator.category ?? "").toLowerCase().includes(term))
  );

  return c.json({ creators: matchingCreators, videos: uniqueVideos, hashtags, source: "db" });
});

/** Trending creators, hashtags, top/new content for the discover surface. */
discoveryRoutes.get("/discover/trending", async (c) => {
  if (!isBackendConfigured()) {
    const creators = mockCreatorSummaries();
    const hashtagCounts = new Map<string, number>();
    for (const video of mockVideos) {
      for (const tag of video.hashtags) {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + video.watchCount);
      }
    }
    return c.json({
      trendingCreators: [...creators].sort((a, b) => b.followerCount - a.followerCount).slice(0, 8),
      premiumCreators: creators.filter((creator) => creator.monetizationEnabled).slice(0, 8),
      newCreators: [...creators].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 8),
      trendingHashtags: [...hashtagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag),
      topVideos: mockVideos
        .filter((video) => video.visibility === "public")
        .sort((a, b) => b.watchCount - a.watchCount)
        .slice(0, 10)
        .map((video) => ({ id: video.id, caption: video.caption, watchCount: video.watchCount })),
      source: "mock"
    });
  }

  const profile = c.get("profile");
  const blocked = await blockedCreatorIds(profile?.id);
  const creators = (await dbCreatorSummaries()).filter((creator) => !blocked.has(creator.id));

  const { data: videoRows, error } = await visibleVideosQuery()
    .order("watch_count", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);
  const visible = applyFeedRules((videoRows ?? []) as unknown as VideoRow[], blocked);

  const hashtagCounts = new Map<string, number>();
  for (const row of visible) {
    for (const tag of row.hashtags) {
      hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + Number(row.watch_count));
    }
  }

  return c.json({
    trendingCreators: [...creators].sort((a, b) => b.followerCount - a.followerCount).slice(0, 8),
    premiumCreators: creators
      .filter((creator) => creator.monetizationEnabled)
      .sort((a, b) => b.subscriberCount - a.subscriberCount)
      .slice(0, 8),
    newCreators: [...creators]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 8),
    trendingHashtags: [...hashtagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag),
    topVideos: visible.slice(0, 10).map(toFeedDto),
    source: "db"
  });
});

/** Content categories (normalized taxonomy). */
discoveryRoutes.get("/categories", async (c) => {
  if (!isBackendConfigured()) {
    const categories = [...new Set(mockVideos.map((video) => video.category).filter(Boolean))].map((label, index) => ({
      id: `mock_cat_${index}`,
      slug: String(label).toLowerCase().replace(/\s+/g, "-"),
      label,
      isActive: true
    }));
    return c.json({ categories, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("categories")
    .select("id, slug, label, description, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw badRequest(error.message);
  return c.json({ categories: data ?? [], source: "db" });
});

/** Sounds: search + trending by usage. */
discoveryRoutes.get("/sounds", async (c) => {
  const term = (c.req.query("q") ?? "").trim().toLowerCase();
  if (!isBackendConfigured()) {
    const sounds = [
      { id: "mock_sound_1", title: "Golden Hour Loop", artistName: "Vuqiro Library", videoCount: 128 },
      { id: "mock_sound_2", title: "City Nights", artistName: "Vuqiro Library", videoCount: 86 },
      { id: "mock_sound_3", title: "Kitchen Rhythm", artistName: "Sola", videoCount: 42 }
    ].filter((sound) => !term || sound.title.toLowerCase().includes(term));
    return c.json({ sounds, source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db
    .from("sounds")
    .select("id, title, artist_name, audio_url, duration_seconds, video_count")
    .eq("is_blocked", false)
    .order("video_count", { ascending: false })
    .limit(50);
  if (term) query = query.ilike("title", `%${term}%`);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({
    sounds: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      artistName: row.artist_name,
      audioUrl: row.audio_url ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      videoCount: row.video_count
    })),
    source: "db"
  });
});

/** A creator's public storefront feed. Locked items are metadata-only. */
discoveryRoutes.get("/creators/:id/videos", async (c) => {
  const id = z.string().min(1).max(64).parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    const items = mockVideos.filter((video) => video.creatorId === id);
    return c.json({ items, source: "mock" });
  }

  const profile = c.get("profile");
  const blocked = await blockedCreatorIds(profile?.id);
  if (blocked.has(id)) return c.json({ items: [], source: "db" });

  const { data, error } = await visibleVideosQuery()
    .eq("creator_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);

  const items = applyFeedRules(data as unknown as VideoRow[], blocked).map(toFeedDto);
  return c.json({ items, source: "db" });
});
