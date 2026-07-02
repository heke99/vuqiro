import { Hono } from "hono";
import { mockCreatorAnalytics, mockVideos } from "@vuqiro/mock-data";
import { forbidden } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireAdmin, requireUser } from "../middleware/auth";

export const analyticsRoutes = new Hono<AppEnv>();

/** Platform analytics for the admin console. */
analyticsRoutes.get("/admin/analytics", requireAdmin(), async (c) => {
  if (!isBackendConfigured()) {
    return c.json({
      eventCounts: {
        video_impression: 48210,
        video_play: 39800,
        video_complete: 21400,
        video_like: 8200,
        video_share: 1900,
        comment_submit: 3100,
        creator_follow: 2400,
        report_submit: 44
      },
      topVideos: mockVideos
        .slice()
        .sort((a, b) => b.watchCount - a.watchCount)
        .slice(0, 10)
        .map((video) => ({ id: video.id, caption: video.caption, watchCount: video.watchCount })),
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const since = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();
  const { data: events } = await db
    .from("video_events")
    .select("name")
    .gte("created_at", since)
    .limit(10_000);

  const eventCounts: Record<string, number> = {};
  for (const event of events ?? []) {
    eventCounts[event.name] = (eventCounts[event.name] ?? 0) + 1;
  }

  const { data: topVideos } = await db
    .from("videos")
    .select("id, caption, watch_count")
    .eq("status", "ready")
    .order("watch_count", { ascending: false })
    .limit(10);

  return c.json({ eventCounts, topVideos: topVideos ?? [], source: "db" });
});

analyticsRoutes.use("/creators/me/analytics", attachUser);

/** The calling creator's own analytics summary. Creators see only their data. */
analyticsRoutes.get("/creators/me/analytics", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ analytics: mockCreatorAnalytics[0], source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: creator } = await db.from("creators").select("id").eq("profile_id", profile.id).maybeSingle();
  if (!creator) throw forbidden("Not a creator account");

  const since = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();
  const [{ data: videos }, { count: followersGained }, { count: subscribersGained }, { data: ledger }] =
    await Promise.all([
      db.from("videos").select("id, watch_count, like_count").eq("creator_id", creator.id).eq("status", "ready"),
      db
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creator.id)
        .gte("created_at", since),
      db
        .from("creator_memberships")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creator.id)
        .gte("created_at", since),
      db
        .from("creator_revenue_ledger")
        .select("source, net_amount, status")
        .eq("creator_id", creator.id)
        .gte("created_at", since)
    ]);

  const videoIds = (videos ?? []).map((video) => video.id);
  let completes = 0;
  let impressions = 0;
  let watchSeconds = 0;
  if (videoIds.length > 0) {
    const { data: events } = await db
      .from("video_events")
      .select("name, value, video_id")
      .in("video_id", videoIds)
      .gte("created_at", since)
      .limit(10_000);
    for (const event of events ?? []) {
      if (event.name === "video_complete") completes += 1;
      if (event.name === "video_impression") impressions += 1;
      if (event.name === "video_progress") watchSeconds += Number(event.value ?? 0);
    }
  }

  const sumBySource = (source: string) =>
    (ledger ?? [])
      .filter((entry) => entry.source === source)
      .reduce((sum, entry) => sum + Number(entry.net_amount), 0);

  return c.json({
    analytics: {
      creatorId: creator.id,
      views: (videos ?? []).reduce((sum, video) => sum + Number(video.watch_count), 0),
      watchTimeHours: Number((watchSeconds / 3600).toFixed(1)),
      completionRate: impressions > 0 ? Number((completes / impressions).toFixed(3)) : 0,
      followersGained: followersGained ?? 0,
      subscribersGained: subscribersGained ?? 0,
      coinTips: sumBySource("tip"),
      unlockRevenue: sumBySource("unlock"),
      subscriptionRevenue: sumBySource("subscription"),
      payoutPending: (ledger ?? [])
        .filter((entry) => entry.status === "payable" || entry.status === "pending")
        .reduce((sum, entry) => sum + Number(entry.net_amount), 0),
      payoutPaid: (ledger ?? [])
        .filter((entry) => entry.status === "paid")
        .reduce((sum, entry) => sum + Number(entry.net_amount), 0)
    },
    source: "db"
  });
});
