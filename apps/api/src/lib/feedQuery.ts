import { loadEnv } from "@vuqiro/config";
import { preparePlaybackUrl } from "./playback";
import { getServiceDb } from "./supabase";
import { canViewVideo, type AccessVideo, type ViewerContext } from "./videoAccess";

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
  status?: string;
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
  "id, creator_id, caption, hashtags, category, visibility, status, moderation_status, coin_unlock_price, required_tier, playback_url, thumbnail_url, like_count, comment_count, share_count, save_count, watch_count, report_count, safety_score, duration_seconds, is_featured, created_at, creators (id, profile_id, verification_status, monetization_enabled, profiles (handle, display_name, status, follower_count))";

/** Maps a DB row to the shape the central access rules consume. */
export function rowToAccessVideo(row: VideoRow): AccessVideo {
  return {
    id: row.id,
    creatorId: row.creator_id,
    visibility: row.visibility,
    status: row.status ?? "ready",
    moderationStatus: row.moderation_status,
    requiredTier: row.required_tier
  };
}

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
    playbackUrl: locked ? undefined : preparePlaybackUrl(row.playback_url),
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

/** Per-viewer access filter for DB rows (see lib/videoAccess.ts). */
export function filterViewableRows(viewer: ViewerContext, rows: VideoRow[]): VideoRow[] {
  return rows.filter((row) => canViewVideo(viewer, rowToAccessVideo(row)));
}

/**
 * True when demo/seeded content must be excluded from listing surfaces:
 * production always excludes it unless the deployment is explicitly running
 * in DEMO_MODE.
 */
export function shouldExcludeDemoContent(): boolean {
  const env = loadEnv();
  return env.appEnv === "production" && !env.demoMode;
}

/**
 * Base query for listable videos (lifecycle + moderation + not private).
 * This is only the shared pre-filter: callers MUST still apply the
 * per-viewer access rules (`getVisibleVideosForViewer`) before returning
 * rows, so members-only/followers-only content never reaches unauthorized
 * viewers.
 */
export function visibleVideosQuery() {
  const db = getServiceDb()!;
  let query = db
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("status", "ready")
    .in("moderation_status", ["visible", "limited", "age_restricted"])
    .neq("visibility", "private");
  if (shouldExcludeDemoContent()) {
    query = query.eq("is_demo", false);
  }
  return query;
}

/**
 * Sanitized teaser for a coin-unlockable video the viewer has not purchased.
 * Deliberately excludes playback AND thumbnail URLs (Mux thumbnails embed the
 * playback id, which would leak a derivable stream URL) and any private
 * metadata — only what a storefront needs to sell the unlock.
 */
export type LockedTeaserDto = {
  id: string;
  creatorId: string;
  caption: string;
  visibility: string;
  coinUnlockPrice?: number;
  requiredTier?: string;
  likeCount: number;
  watchCount: number;
  isPremium: true;
  locked: true;
};

export function toLockedTeaserDto(row: {
  id: string;
  creator_id: string;
  caption: string;
  visibility: string;
  coin_unlock_price: number | null;
  required_tier: string | null;
  like_count: number;
  watch_count: number;
}): LockedTeaserDto {
  return {
    id: row.id,
    creatorId: row.creator_id,
    caption: row.caption,
    visibility: row.visibility,
    coinUnlockPrice: row.coin_unlock_price ?? undefined,
    requiredTier: row.required_tier ?? undefined,
    likeCount: row.like_count,
    watchCount: Number(row.watch_count),
    isPremium: true,
    locked: true
  };
}
