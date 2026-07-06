import { getServiceDb } from "./supabase";
import { rankVideos, scoreVideo, type RankedVideo, type RankingInput } from "./ranking";
import { DEFAULT_FEED_WEIGHTS, getPlatformSetting, type FeedWeightSettings } from "./platformSettings";
import { VIDEO_SELECT, type VideoRow } from "./feedQuery";

type ViewerContext = {
  followedCreatorIds: Set<string>;
  subscribedCreatorIds: Set<string>;
  interests: Set<string>;
};

async function loadViewerContext(profileId: string | undefined): Promise<ViewerContext> {
  const db = getServiceDb();
  if (!db || !profileId) {
    return { followedCreatorIds: new Set(), subscribedCreatorIds: new Set(), interests: new Set() };
  }
  const [{ data: follows }, { data: memberships }, { data: interests }] = await Promise.all([
    db.from("follows").select("creator_id").eq("follower_id", profileId),
    db.from("creator_memberships").select("creator_id").eq("profile_id", profileId).eq("status", "active"),
    db.from("user_interests").select("interest").eq("profile_id", profileId)
  ]);
  return {
    followedCreatorIds: new Set((follows ?? []).map((row) => row.creator_id)),
    subscribedCreatorIds: new Set((memberships ?? []).map((row) => row.creator_id)),
    interests: new Set((interests ?? []).map((row) => String(row.interest).toLowerCase()))
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

/** Active boost campaigns per video, normalized 0..1 by spend. */
async function loadActiveBoosts(videoIds: string[]): Promise<Map<string, number>> {
  const boosts = new Map<string, number>();
  const db = getServiceDb();
  if (!db || videoIds.length === 0) return boosts;
  const { data } = await db
    .from("boost_campaigns")
    .select("video_id, coins_spent")
    .in("video_id", videoIds)
    .eq("status", "active");
  for (const campaign of data ?? []) {
    const score = Math.min(1, campaign.coins_spent / 2500);
    boosts.set(campaign.video_id, Math.max(boosts.get(campaign.video_id) ?? 0, score));
  }
  return boosts;
}

function buildRankingInput(
  row: VideoRow,
  context: {
    viewer: ViewerContext;
    aggregates: EventAggregates;
    boosts: Map<string, number>;
    videosPerCreator: Map<string, number>;
  }
): RankingInput {
  const events = context.aggregates.get(row.id);
  const impressions = Math.max(events?.impressions ?? 0, 1);
  const category = (row.category ?? "").toLowerCase();
  const interests = context.viewer.interests;
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
    creatorFollowerCount: row.creators?.profiles?.follower_count ?? 0,
    creatorVerified: row.creators?.verification_status === "verified",
    creatorVideoCount: context.videosPerCreator.get(row.creator_id) ?? 1,
    viewerFollowsCreator: context.viewer.followedCreatorIds.has(row.creator_id),
    viewerSubscribedToCreator: context.viewer.subscribedCreatorIds.has(row.creator_id),
    categoryMatch: interests.size > 0 && category.length > 0 && interests.has(category),
    hashtagMatch:
      interests.size > 0 && (row.hashtags ?? []).some((tag) => interests.has(String(tag).toLowerCase())),
    boostScore: context.boosts.get(row.id) ?? 0,
    isFeatured: row.is_featured === true
  };
}

/**
 * Ranks visible video rows for a viewer using the deterministic V1 engine,
 * blending stored counters with recent watch-event aggregates. Weights come
 * from the superadmin-tunable platform_settings.feed_weights.
 */
export async function rankFeedRows(rows: VideoRow[], profileId: string | undefined): Promise<VideoRow[]> {
  if (rows.length === 0) return rows;

  const [viewer, aggregates, boosts, weights] = await Promise.all([
    loadViewerContext(profileId),
    loadEventAggregates(rows.map((row) => row.id)),
    loadActiveBoosts(rows.map((row) => row.id)),
    getPlatformSetting<FeedWeightSettings>("feed_weights", DEFAULT_FEED_WEIGHTS)
  ]);

  const videosPerCreator = new Map<string, number>();
  for (const row of rows) {
    videosPerCreator.set(row.creator_id, (videosPerCreator.get(row.creator_id) ?? 0) + 1);
  }

  const inputs: RankingInput[] = rows.map((row) =>
    buildRankingInput(row, { viewer, aggregates, boosts, videosPerCreator })
  );

  const ranked = rankVideos(inputs, new Date(), weights);
  const order = new Map(ranked.map((item, index) => [item.videoId, index]));
  return [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export type RankingExplanation = {
  videoId: string;
  result: RankedVideo;
  input: RankingInput;
  weights: FeedWeightSettings;
};

/**
 * Full ranking breakdown for one video — powers the admin ranking inspector.
 * Uses the same signal assembly as the live feed so admins see exactly why a
 * video ranks the way it does.
 */
export async function explainVideoRanking(videoId: string): Promise<RankingExplanation | null> {
  const db = getServiceDb();
  if (!db) return null;
  const { data: row } = await db.from("videos").select(VIDEO_SELECT).eq("id", videoId).maybeSingle();
  if (!row) return null;

  const videoRow = row as unknown as VideoRow;
  const [aggregates, boosts, weights] = await Promise.all([
    loadEventAggregates([videoId]),
    loadActiveBoosts([videoId]),
    getPlatformSetting<FeedWeightSettings>("feed_weights", DEFAULT_FEED_WEIGHTS)
  ]);

  const input = buildRankingInput(videoRow, {
    viewer: { followedCreatorIds: new Set(), subscribedCreatorIds: new Set(), interests: new Set() },
    aggregates,
    boosts,
    videosPerCreator: new Map([[videoRow.creator_id, 1]])
  });
  return { videoId, result: scoreVideo(input, new Date(), weights), input, weights };
}
