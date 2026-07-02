import { getServiceDb } from "./supabase";
import { rankVideos, type RankingInput } from "./ranking";
import type { VideoRow } from "./feedQuery";

type ViewerContext = {
  followedCreatorIds: Set<string>;
  subscribedCreatorIds: Set<string>;
};

async function loadViewerContext(profileId: string | undefined): Promise<ViewerContext> {
  const db = getServiceDb();
  if (!db || !profileId) {
    return { followedCreatorIds: new Set(), subscribedCreatorIds: new Set() };
  }
  const [{ data: follows }, { data: memberships }] = await Promise.all([
    db.from("follows").select("creator_id").eq("follower_id", profileId),
    db.from("creator_memberships").select("creator_id").eq("profile_id", profileId).eq("status", "active")
  ]);
  return {
    followedCreatorIds: new Set((follows ?? []).map((row) => row.creator_id)),
    subscribedCreatorIds: new Set((memberships ?? []).map((row) => row.creator_id))
  };
}

type EventAggregates = Map<
  string,
  { progressSum: number; progressCount: number; completes: number; skips: number; rewatches: number; impressions: number }
>;

async function loadEventAggregates(videoIds: string[]): Promise<EventAggregates> {
  const aggregates: EventAggregates = new Map();
  const db = getServiceDb();
  if (!db || videoIds.length === 0) return aggregates;

  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const { data } = await db
    .from("video_events")
    .select("video_id, name, value")
    .in("video_id", videoIds)
    .gte("created_at", since)
    .limit(5000);

  for (const event of data ?? []) {
    if (!event.video_id) continue;
    const entry =
      aggregates.get(event.video_id) ??
      ({ progressSum: 0, progressCount: 0, completes: 0, skips: 0, rewatches: 0, impressions: 0 } as const as {
        progressSum: number;
        progressCount: number;
        completes: number;
        skips: number;
        rewatches: number;
        impressions: number;
      });
    switch (event.name) {
      case "video_progress":
        entry.progressSum += Number(event.value ?? 0);
        entry.progressCount += 1;
        break;
      case "video_complete":
        entry.completes += 1;
        break;
      case "video_skip":
        entry.skips += 1;
        break;
      case "video_rewatch":
        entry.rewatches += 1;
        break;
      case "video_impression":
        entry.impressions += 1;
        break;
      default:
        break;
    }
    aggregates.set(event.video_id, entry);
  }
  return aggregates;
}

/**
 * Ranks visible video rows for a viewer using the deterministic V1 engine,
 * blending stored counters with recent watch-event aggregates.
 */
export async function rankFeedRows(rows: VideoRow[], profileId: string | undefined): Promise<VideoRow[]> {
  if (rows.length === 0) return rows;

  const [viewer, aggregates] = await Promise.all([
    loadViewerContext(profileId),
    loadEventAggregates(rows.map((row) => row.id))
  ]);

  const videosPerCreator = new Map<string, number>();
  for (const row of rows) {
    videosPerCreator.set(row.creator_id, (videosPerCreator.get(row.creator_id) ?? 0) + 1);
  }

  const inputs: RankingInput[] = rows.map((row) => {
    const events = aggregates.get(row.id);
    const impressions = Math.max(events?.impressions ?? 0, 1);
    return {
      videoId: row.id,
      creatorId: row.creator_id,
      createdAt: row.created_at,
      watchCount: Number(row.watch_count),
      likeCount: row.like_count,
      commentCount: row.comment_count,
      saveCount: row.save_count ?? 0,
      shareCount: row.share_count,
      avgWatchSeconds: events && events.progressCount > 0 ? events.progressSum / events.progressCount : undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      completionRate: events ? Math.min(1, events.completes / impressions) : undefined,
      rewatchRate: events ? Math.min(1, events.rewatches / impressions) : undefined,
      skipRate: events ? Math.min(1, events.skips / impressions) : undefined,
      safetyScore: row.safety_score ?? 100,
      moderationStatus: row.moderation_status,
      reportCount: row.report_count ?? 0,
      creatorFollowerCount: 0,
      creatorVerified: row.creators?.verification_status === "verified",
      creatorVideoCount: videosPerCreator.get(row.creator_id) ?? 1,
      viewerFollowsCreator: viewer.followedCreatorIds.has(row.creator_id),
      viewerSubscribedToCreator: viewer.subscribedCreatorIds.has(row.creator_id)
    };
  });

  const ranked = rankVideos(inputs);
  const order = new Map(ranked.map((item, index) => [item.videoId, index]));
  return [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
