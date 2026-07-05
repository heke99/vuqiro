import { getServiceDb } from "./supabase";

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
  /** True when reach is paid (active boost). Clients must label it. */
  promoted?: boolean;
  createdAt?: string;
};

export type VideoRow = {
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
  save_count?: number;
  watch_count: number;
  report_count?: number;
  safety_score?: number;
  duration_seconds?: number | null;
  is_featured?: boolean;
  created_at: string;
  creators: {
    id: string;
    profile_id: string;
    verification_status: string;
    monetization_enabled?: boolean;
    profiles: { handle: string; display_name: string; status: string; follower_count?: number } | null;
  } | null;
};

export const VIDEO_SELECT =
  "id, creator_id, caption, hashtags, category, visibility, moderation_status, coin_unlock_price, required_tier, playback_url, thumbnail_url, like_count, comment_count, share_count, save_count, watch_count, report_count, safety_score, duration_seconds, is_featured, created_at, creators (id, profile_id, verification_status, monetization_enabled, profiles (handle, display_name, status, follower_count))";

export function toFeedDto(row: VideoRow): FeedItemDto {
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
    // Server-side entitlement rule: locked content never exposes playback.
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

/** Creators the viewer has blocked (as creator ids). */
export async function blockedCreatorIds(profileId: string | undefined): Promise<Set<string>> {
  const db = getServiceDb();
  if (!db || !profileId) return new Set();
  const { data } = await db.from("blocks").select("blocked_profile_id").eq("blocker_id", profileId);
  if (!data || data.length === 0) return new Set();
  const blockedProfiles = data.map((row) => row.blocked_profile_id);
  const { data: creators } = await db.from("creators").select("id").in("profile_id", blockedProfiles);
  return new Set((creators ?? []).map((row) => row.id));
}

/** Creators the viewer has muted (as creator ids). Soft hide: feeds only. */
export async function mutedCreatorIds(profileId: string | undefined): Promise<Set<string>> {
  const db = getServiceDb();
  if (!db || !profileId) return new Set();
  const { data } = await db.from("mutes").select("muted_profile_id").eq("muter_id", profileId);
  if (!data || data.length === 0) return new Set();
  const mutedProfiles = data.map((row) => row.muted_profile_id);
  const { data: creators } = await db.from("creators").select("id").in("profile_id", mutedProfiles);
  return new Set((creators ?? []).map((row) => row.id));
}

/**
 * Creators hidden from feed surfaces: blocked (hard, applies everywhere) plus
 * muted (soft, feeds only — muted creators stay searchable).
 */
export async function hiddenCreatorIds(profileId: string | undefined): Promise<Set<string>> {
  const [blocked, muted] = await Promise.all([blockedCreatorIds(profileId), mutedCreatorIds(profileId)]);
  return new Set([...blocked, ...muted]);
}

/** Videos the viewer marked not-interested (excluded from For You). */
export async function notInterestedVideoIds(profileId: string | undefined): Promise<Set<string>> {
  const db = getServiceDb();
  if (!db || !profileId) return new Set();
  const { data } = await db.from("video_not_interested").select("video_id").eq("profile_id", profileId);
  return new Set((data ?? []).map((row) => row.video_id));
}

/**
 * Applies the universal feed visibility rules that cannot be expressed in a
 * single query filter: blocked creators and banned/suspended creator accounts
 * are always hidden.
 */
export function applyFeedRules(rows: VideoRow[], blocked: Set<string>): VideoRow[] {
  return rows.filter((row) => {
    if (blocked.has(row.creator_id)) return false;
    const creatorStatus = row.creators?.profiles?.status;
    if (creatorStatus === "banned" || creatorStatus === "suspended" || creatorStatus === "deleted") {
      return false;
    }
    return true;
  });
}

/** Base query for publicly listable videos. */
export function visibleVideosQuery() {
  const db = getServiceDb()!;
  return db
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("status", "ready")
    .in("moderation_status", ["visible", "limited", "age_restricted"])
    .neq("visibility", "private");
}
