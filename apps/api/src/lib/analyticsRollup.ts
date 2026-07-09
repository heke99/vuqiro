import { getServiceDb, isBackendConfigured } from "./supabase";

/**
 * Daily analytics rollups. Aggregates raw event/engagement rows for one UTC
 * date into video_analytics_daily and creator_analytics_daily so dashboards
 * never scan event tables. Idempotent: re-running a date overwrites its
 * rollup rows. Run daily by cron (or manually from the ops console).
 */

type VideoDayAggregate = {
  views: number;
  uniqueViewers: Set<string>;
  watchMs: number;
  completions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

function emptyAggregate(): VideoDayAggregate {
  return { views: 0, uniqueViewers: new Set(), watchMs: 0, completions: 0, likes: 0, comments: 0, saves: 0, shares: 0 };
}

export async function computeDailyRollups(
  dateInput?: string
): Promise<{ date: string; videos: number; creators: number } | null> {
  if (!isBackendConfigured()) return null;
  const db = getServiceDb()!;

  // Default: yesterday UTC (the last complete day).
  const date = dateInput ?? new Date(Date.now() - 24 * 3_600_000).toISOString().slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const byVideo = new Map<string, VideoDayAggregate>();
  const aggregate = (videoId: string) => {
    const existing = byVideo.get(videoId);
    if (existing) return existing;
    const created = emptyAggregate();
    byVideo.set(videoId, created);
    return created;
  };

  const [{ data: impressions }, { data: likes }, { data: comments }, { data: saves }, { data: shares }] =
    await Promise.all([
      db
        .from("feed_impressions")
        .select("video_id, profile_id, watched_ms, completed")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .not("video_id", "is", null)
        // Synthetic/seeded impressions never enter analytics rollups (and so
        // never reach creator dashboards, payout context or ad reporting).
        .eq("is_synthetic", false)
        .limit(50000),
      db.from("likes").select("video_id").gte("created_at", dayStart).lte("created_at", dayEnd).limit(50000),
      db
        .from("comments")
        .select("video_id")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .limit(50000),
      db.from("saves").select("video_id").gte("created_at", dayStart).lte("created_at", dayEnd).limit(50000),
      db.from("shares").select("video_id").gte("created_at", dayStart).lte("created_at", dayEnd).limit(50000)
    ]);

  for (const impression of impressions ?? []) {
    const entry = aggregate(impression.video_id);
    entry.views += 1;
    if (impression.profile_id) entry.uniqueViewers.add(impression.profile_id);
    entry.watchMs += Number(impression.watched_ms ?? 0);
    if (impression.completed) entry.completions += 1;
  }
  for (const like of likes ?? []) aggregate(like.video_id).likes += 1;
  for (const comment of comments ?? []) aggregate(comment.video_id).comments += 1;
  for (const save of saves ?? []) aggregate(save.video_id).saves += 1;
  for (const share of shares ?? []) aggregate(share.video_id).shares += 1;

  if (byVideo.size === 0) return { date, videos: 0, creators: 0 };

  // Resolve creators for the touched videos.
  const videoIds = [...byVideo.keys()];
  const { data: videoRows } = await db.from("videos").select("id, creator_id").in("id", videoIds);
  const creatorByVideo = new Map((videoRows ?? []).map((row) => [row.id, row.creator_id as string]));

  // Upsert video rollups.
  const videoRollups = videoIds
    .filter((videoId) => creatorByVideo.has(videoId))
    .map((videoId) => {
      const entry = byVideo.get(videoId)!;
      return {
        video_id: videoId,
        date,
        views: entry.views,
        unique_viewers: entry.uniqueViewers.size,
        watch_ms: entry.watchMs,
        completions: entry.completions,
        likes: entry.likes,
        comments: entry.comments,
        saves: entry.saves,
        shares: entry.shares
      };
    });
  if (videoRollups.length > 0) {
    const { error } = await db.from("video_analytics_daily").upsert(videoRollups, { onConflict: "video_id,date" });
    if (error) throw new Error(`video rollup upsert failed: ${error.message}`);
  }

  // Creator rollups: sum their videos' aggregates + follower/coin movements.
  const byCreator = new Map<string, VideoDayAggregate>();
  for (const videoId of videoIds) {
    const creatorId = creatorByVideo.get(videoId);
    if (!creatorId) continue;
    const source = byVideo.get(videoId)!;
    const target = byCreator.get(creatorId) ?? emptyAggregate();
    target.views += source.views;
    target.watchMs += source.watchMs;
    target.likes += source.likes;
    target.comments += source.comments;
    target.saves += source.saves;
    target.shares += source.shares;
    byCreator.set(creatorId, target);
  }

  const creatorIds = [...byCreator.keys()];
  const [{ data: followsGained }, { data: earnings }] = await Promise.all([
    db
      .from("follows")
      .select("creator_id")
      .in("creator_id", creatorIds)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(50000),
    db
      .from("creator_revenue_ledger")
      .select("creator_id, net_amount")
      .in("creator_id", creatorIds)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(50000)
  ]);
  const followsByCreator = new Map<string, number>();
  for (const follow of followsGained ?? []) {
    followsByCreator.set(follow.creator_id, (followsByCreator.get(follow.creator_id) ?? 0) + 1);
  }
  const coinsByCreator = new Map<string, number>();
  for (const entry of earnings ?? []) {
    coinsByCreator.set(entry.creator_id, (coinsByCreator.get(entry.creator_id) ?? 0) + Number(entry.net_amount));
  }

  const creatorRollups = creatorIds.map((creatorId) => {
    const entry = byCreator.get(creatorId)!;
    return {
      creator_id: creatorId,
      date,
      views: entry.views,
      watch_ms: entry.watchMs,
      likes: entry.likes,
      comments: entry.comments,
      saves: entry.saves,
      shares: entry.shares,
      followers_gained: followsByCreator.get(creatorId) ?? 0,
      followers_lost: 0,
      coins_earned: Math.max(0, Math.round(coinsByCreator.get(creatorId) ?? 0))
    };
  });
  if (creatorRollups.length > 0) {
    const { error } = await db
      .from("creator_analytics_daily")
      .upsert(creatorRollups, { onConflict: "creator_id,date" });
    if (error) throw new Error(`creator rollup upsert failed: ${error.message}`);
  }

  return { date, videos: videoRollups.length, creators: creatorRollups.length };
}
