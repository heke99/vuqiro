import { getServiceDb } from "./supabase";

/**
 * Time-window trending computation. Scores are derived from recent
 * feed/watch events (not all-time counters) so trends reflect velocity and
 * cannot be dominated by old evergreen content. Only ready + visible content
 * counts; removed/under-review/blocked videos are excluded, which also keeps
 * mass-report-brigaded content out of trending.
 */

export type TrendWindow = "daily" | "weekly";

type SnapshotRow = {
  kind: "hashtag" | "video" | "sound" | "creator";
  reference_id: string;
  rank: number;
  score: number;
  time_window: TrendWindow;
  captured_at: string;
};

const WINDOW_HOURS: Record<TrendWindow, number> = { daily: 24, weekly: 168 };

export async function computeTrendSnapshots(
  window: TrendWindow = "daily"
): Promise<{ captured: number; capturedAt: string } | null> {
  const db = getServiceDb();
  if (!db) return null;

  const since = new Date(Date.now() - WINDOW_HOURS[window] * 3_600_000).toISOString();
  const capturedAt = new Date().toISOString();

  // Windowed event counts per video (impressions + weighted completes/likes).
  const { data: events } = await db
    .from("video_events")
    .select("video_id, name")
    .gte("created_at", since)
    .limit(20000);

  const videoScores = new Map<string, number>();
  for (const event of events ?? []) {
    if (!event.video_id) continue;
    const weight =
      event.name === "video_complete" ? 3 : event.name === "video_rewatch" ? 2 : event.name === "video_impression" ? 1 : 0;
    if (weight === 0) continue;
    videoScores.set(event.video_id, (videoScores.get(event.video_id) ?? 0) + weight);
  }

  // Recent engagement rows add signal beyond raw watch events.
  const [{ data: recentLikes }, { data: recentShares }] = await Promise.all([
    db.from("likes").select("video_id").gte("created_at", since).limit(20000),
    db.from("shares").select("video_id").gte("created_at", since).limit(20000)
  ]);
  for (const like of recentLikes ?? []) {
    videoScores.set(like.video_id, (videoScores.get(like.video_id) ?? 0) + 2);
  }
  for (const share of recentShares ?? []) {
    videoScores.set(share.video_id, (videoScores.get(share.video_id) ?? 0) + 3);
  }

  if (videoScores.size === 0) return { captured: 0, capturedAt };

  // Only safe, visible, ready videos may trend.
  const { data: videoRows } = await db
    .from("videos")
    .select("id, creator_id, hashtags, sound_id")
    .in("id", [...videoScores.keys()])
    .eq("status", "ready")
    .eq("moderation_status", "visible")
    .eq("visibility", "public");

  const eligible = (videoRows ?? []) as { id: string; creator_id: string; hashtags: string[]; sound_id: string | null }[];

  const creatorScores = new Map<string, number>();
  const tagScores = new Map<string, number>();
  const soundScores = new Map<string, number>();
  for (const video of eligible) {
    const score = videoScores.get(video.id) ?? 0;
    creatorScores.set(video.creator_id, (creatorScores.get(video.creator_id) ?? 0) + score);
    for (const tag of video.hashtags ?? []) {
      tagScores.set(String(tag).toLowerCase(), (tagScores.get(String(tag).toLowerCase()) ?? 0) + score);
    }
    if (video.sound_id) {
      soundScores.set(video.sound_id, (soundScores.get(video.sound_id) ?? 0) + score);
    }
  }

  // Hashtag names → hashtag ids (trend_snapshots references are uuids).
  const topTags = [...tagScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const { data: hashtagRows } = topTags.length
    ? await db
        .from("hashtags")
        .select("id, tag")
        .in("tag", topTags.map(([tag]) => tag))
        .eq("is_blocked", false)
    : { data: [] as { id: string; tag: string }[] };
  const tagIdByName = new Map((hashtagRows ?? []).map((row) => [row.tag, row.id]));

  const snapshots: SnapshotRow[] = [];
  const pushRanked = (kind: SnapshotRow["kind"], entries: [string, number][]) => {
    entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([referenceId, score], index) => {
        snapshots.push({
          kind,
          reference_id: referenceId,
          rank: index + 1,
          score: Number(score.toFixed(4)),
          time_window: window,
          captured_at: capturedAt
        });
      });
  };

  pushRanked(
    "video",
    eligible.map((video) => [video.id, videoScores.get(video.id) ?? 0])
  );
  pushRanked("creator", [...creatorScores.entries()]);
  pushRanked("sound", [...soundScores.entries()]);
  pushRanked(
    "hashtag",
    topTags.flatMap(([tag, score]) => {
      const id = tagIdByName.get(tag);
      return id ? ([[id, score]] as [string, number][]) : [];
    })
  );

  if (snapshots.length > 0) {
    const { error } = await db.from("trend_snapshots").insert(snapshots);
    if (error) throw new Error(`trend snapshot insert failed: ${error.message}`);
  }
  return { captured: snapshots.length, capturedAt };
}

export type TrendingSnapshotSets = {
  capturedAt: string;
  videoIds: string[];
  creatorIds: string[];
  hashtagIds: string[];
  soundIds: string[];
};

/** Latest snapshot set within the freshness window (default 26h), or null. */
export async function latestTrendSnapshots(window: TrendWindow = "daily"): Promise<TrendingSnapshotSets | null> {
  const db = getServiceDb();
  if (!db) return null;
  const freshSince = new Date(Date.now() - 26 * 3_600_000).toISOString();
  const { data: latest } = await db
    .from("trend_snapshots")
    .select("captured_at")
    .eq("time_window", window)
    .gte("captured_at", freshSince)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;

  const { data: rows } = await db
    .from("trend_snapshots")
    .select("kind, reference_id, rank")
    .eq("time_window", window)
    .eq("captured_at", latest.captured_at)
    .order("rank");

  const byKind = (kind: string) =>
    (rows ?? []).filter((row) => row.kind === kind).map((row) => row.reference_id as string);
  return {
    capturedAt: latest.captured_at,
    videoIds: byKind("video"),
    creatorIds: byKind("creator"),
    hashtagIds: byKind("hashtag"),
    soundIds: byKind("sound")
  };
}
