import { Hono } from "hono";
import { z } from "zod";
import { mockCreatorAnalytics, mockVideos } from "@vuqiro/mock-data";
import { csvResponseHeaders, toCsv } from "../lib/csv";
import { forbidden } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireAdmin, requireUser } from "../middleware/auth";

export const analyticsRoutes = new Hono<AppEnv>();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const analyticsQuery = z.object({
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
  format: z.enum(["json", "csv"]).default("json")
});

type DailyPoint = {
  date: string;
  views: number;
  uniqueViewers: number;
  watchHours: number;
  completions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

const MOCK_SERIES: DailyPoint[] = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(Date.now() - (6 - index) * 24 * 3_600_000).toISOString().slice(0, 10);
  return {
    date,
    views: 4200 + index * 380,
    uniqueViewers: 1900 + index * 120,
    watchHours: 310 + index * 22,
    completions: 1600 + index * 130,
    likes: 820 + index * 40,
    comments: 210 + index * 12,
    saves: 150 + index * 9,
    shares: 90 + index * 6
  };
});

/**
 * Platform analytics for the admin console. Reads the daily rollup tables
 * (populated by the analytics rollup job) plus lightweight range counts —
 * never raw event-table scans in the dashboard path.
 */
analyticsRoutes.get("/admin/analytics", requireAdmin(), async (c) => {
  const query = analyticsQuery.parse({
    from: c.req.query("from") || undefined,
    to: c.req.query("to") || undefined,
    format: c.req.query("format") || undefined
  });
  const to = query.to ?? new Date().toISOString().slice(0, 10);
  const from = query.from ?? new Date(Date.now() - 29 * 24 * 3_600_000).toISOString().slice(0, 10);

  if (!isBackendConfigured()) {
    if (query.format === "csv") {
      return c.newResponse(
        toCsv(MOCK_SERIES as unknown as Record<string, unknown>[]),
        200,
        csvResponseHeaders("platform-analytics.csv")
      );
    }
    return c.json({
      range: { from, to },
      totals: {
        newUsers: 412,
        uploads: 96,
        publishedVideos: 84,
        views: MOCK_SERIES.reduce((sum, point) => sum + point.views, 0),
        watchHours: MOCK_SERIES.reduce((sum, point) => sum + point.watchHours, 0),
        completions: MOCK_SERIES.reduce((sum, point) => sum + point.completions, 0),
        likes: MOCK_SERIES.reduce((sum, point) => sum + point.likes, 0),
        comments: MOCK_SERIES.reduce((sum, point) => sum + point.comments, 0),
        reports: 44,
        revenueCents: 182_000,
        adImpressions: 94_273,
        adClicks: 3_993
      },
      series: MOCK_SERIES,
      topVideos: mockVideos
        .slice()
        .sort((a, b) => b.watchCount - a.watchCount)
        .slice(0, 10)
        .map((video) => ({ id: video.id, caption: video.caption, watchCount: video.watchCount })),
      topCreators: [],
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const [
    { data: videoDaily },
    { data: creatorDaily },
    { count: newUsers },
    { count: uploads },
    { count: publishedVideos },
    { count: reports },
    { count: moderationActions },
    { data: revenue },
    { count: adImpressions },
    { count: adClicks },
    { data: topVideos }
  ] = await Promise.all([
    db.from("video_analytics_daily").select("*").gte("date", from).lte("date", to).limit(20000),
    db
      .from("creator_analytics_daily")
      .select("creator_id, views, watch_ms, followers_gained, coins_earned, creators (profiles (handle, display_name))")
      .gte("date", from)
      .lte("date", to)
      .limit(20000),
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    db.from("videos").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    db
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    db.from("reports").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    db
      .from("moderation_actions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    db
      .from("platform_revenue_ledger")
      .select("amount_cents")
      .gte("occurred_at", fromIso)
      .lte("occurred_at", toIso)
      .limit(20000),
    db
      .from("ad_impressions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    db.from("ad_clicks").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    db.from("videos").select("id, caption, watch_count").eq("status", "ready").order("watch_count", { ascending: false }).limit(10)
  ]);

  // Per-day series from the rollup rows.
  const byDate = new Map<string, DailyPoint>();
  for (const row of videoDaily ?? []) {
    const point =
      byDate.get(row.date) ??
      ({
        date: row.date,
        views: 0,
        uniqueViewers: 0,
        watchHours: 0,
        completions: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0
      } as DailyPoint);
    point.views += Number(row.views);
    point.uniqueViewers += Number(row.unique_viewers);
    point.watchHours += Number(row.watch_ms) / 3_600_000;
    point.completions += Number(row.completions);
    point.likes += row.likes;
    point.comments += row.comments;
    point.saves += row.saves;
    point.shares += row.shares;
    byDate.set(row.date, point);
  }
  const series = [...byDate.values()]
    .map((point) => ({ ...point, watchHours: Number(point.watchHours.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (query.format === "csv") {
    return c.newResponse(
      toCsv(series as unknown as Record<string, unknown>[]),
      200,
      csvResponseHeaders("platform-analytics.csv")
    );
  }

  // Top creators for the range (aggregated rollups).
  const creatorAggregates = new Map<string, { handle: string; views: number; followersGained: number; coinsEarned: number }>();
  for (const row of creatorDaily ?? []) {
    const creator = row.creators as unknown as { profiles: { handle?: string; display_name?: string } | null } | null;
    const entry = creatorAggregates.get(row.creator_id) ?? {
      handle: creator?.profiles?.handle ?? "unknown",
      views: 0,
      followersGained: 0,
      coinsEarned: 0
    };
    entry.views += Number(row.views);
    entry.followersGained += row.followers_gained;
    entry.coinsEarned += row.coins_earned;
    creatorAggregates.set(row.creator_id, entry);
  }
  const topCreators = [...creatorAggregates.entries()]
    .map(([creatorId, entry]) => ({ creatorId, ...entry }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const totals = {
    newUsers: newUsers ?? 0,
    uploads: uploads ?? 0,
    publishedVideos: publishedVideos ?? 0,
    views: series.reduce((sum, point) => sum + point.views, 0),
    watchHours: Number(series.reduce((sum, point) => sum + point.watchHours, 0).toFixed(1)),
    completions: series.reduce((sum, point) => sum + point.completions, 0),
    likes: series.reduce((sum, point) => sum + point.likes, 0),
    comments: series.reduce((sum, point) => sum + point.comments, 0),
    reports: reports ?? 0,
    moderationActions: moderationActions ?? 0,
    revenueCents: (revenue ?? []).reduce((sum, entry) => sum + entry.amount_cents, 0),
    adImpressions: adImpressions ?? 0,
    adClicks: adClicks ?? 0
  };

  return c.json({ range: { from, to }, totals, series, topVideos: topVideos ?? [], topCreators, source: "db" });
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
