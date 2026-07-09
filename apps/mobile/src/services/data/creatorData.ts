import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import type { Creator, Video } from "@vuqiro/types";
import { apiFetch, isApiConfigured } from "../api/client";
import { isDemoContentAllowed } from "./demoMode";
import { dtoToEntry, type FeedItemDto } from "./feedData";

/** Public creator profile data: live API when configured, demo data otherwise. */

type DbCreatorResponse = {
  creator: {
    id: string;
    category?: string | null;
    verification_status?: string;
    monetization_enabled?: boolean;
    tiers_enabled?: string[];
    created_at?: string;
    followerCount?: number;
    subscriberCount?: number;
    profiles?: { handle?: string; display_name?: string; bio?: string } | null;
    creator_profiles?: { banner_tone?: string; storefront_headline?: string } | null;
    // Mock mode returns the Creator shape directly.
    handle?: string;
    displayName?: string;
    bio?: string;
    bannerTone?: Creator["bannerTone"];
    isVerified?: boolean;
    totalLikes?: number;
    tiersEnabled?: Creator["tiersEnabled"];
  };
  source: string;
};

function mapDbCreator(data: DbCreatorResponse["creator"]): Creator {
  if (data.handle && data.displayName) {
    // Already in the Creator shape (mock-mode API response).
    return data as unknown as Creator;
  }
  const bannerTone = (data.creator_profiles?.banner_tone ?? "violet") as Creator["bannerTone"];
  return {
    id: data.id,
    handle: data.profiles?.handle ?? "unknown",
    displayName: data.profiles?.display_name ?? "Unknown",
    bio: data.profiles?.bio ?? "",
    bannerTone,
    category: data.category ?? undefined,
    followerCount: data.followerCount ?? 0,
    subscriberCount: data.subscriberCount ?? 0,
    totalLikes: 0,
    isVerified: data.verification_status === "verified",
    monetizationEnabled: data.monetization_enabled,
    tiersEnabled: (data.tiers_enabled ?? ["support", "plus", "premium"]) as Creator["tiersEnabled"],
    createdAt: data.created_at
  };
}

/** Sanitized teaser for a locked video the viewer cannot watch yet: the API
 * never sends playback/thumbnail URLs or private metadata for these. */
export type LockedTeaser = {
  id: string;
  caption: string;
  visibility: string;
  coinUnlockPrice?: number;
  requiredTier?: string;
  watchCount: number;
};

export type CreatorProfileData = {
  creator: Creator;
  /** Only the videos this viewer is allowed to watch. */
  videos: Video[];
  /** How many members-only/followers-only videos exist that the viewer
   * cannot see (aggregate only — no per-video metadata). */
  lockedCount: number;
  /** Storefront teasers for coin-unlockable videos (caption + price only). */
  teasers: LockedTeaser[];
  isLive: boolean;
};

function demoProfileFallback(creatorId: string, exact: boolean): CreatorProfileData | null {
  const creator = exact
    ? mockCreators.find((candidate) => candidate.id === creatorId)
    : (mockCreators.find((candidate) => candidate.id === creatorId) ?? mockCreators[0]);
  if (!creator) return null;
  const creatorVideos = mockVideos.filter((video) => video.creatorId === creator.id);
  // The client-side demo fallback mirrors the API's access rules for an
  // anonymous viewer: public videos only, aggregate locked count, coin
  // teasers without media URLs.
  return {
    creator,
    videos: creatorVideos.filter((video) => video.visibility === "public"),
    lockedCount: creatorVideos.filter(
      (video) =>
        video.visibility !== "public" && video.visibility !== "private" && video.visibility !== "unlock_with_coins"
    ).length,
    teasers: creatorVideos
      .filter((video) => video.visibility === "unlock_with_coins")
      .map((video) => ({
        id: video.id,
        caption: video.caption,
        visibility: video.visibility,
        coinUnlockPrice: video.coinUnlockPrice,
        requiredTier: video.requiredTier,
        watchCount: video.watchCount
      })),
    isLive: false
  };
}

export async function fetchCreatorProfile(creatorId: string): Promise<CreatorProfileData | null> {
  if (!isApiConfigured()) {
    if (!isDemoContentAllowed()) return null;
    return demoProfileFallback(creatorId, false);
  }
  try {
    const [profileResponse, videosResponse] = await Promise.all([
      apiFetch<DbCreatorResponse>(`/creators/${creatorId}`),
      apiFetch<{ items: (FeedItemDto | Video)[]; lockedCount?: number; teasers?: LockedTeaser[]; source: string }>(
        `/creators/${creatorId}/videos`
      )
    ]);
    const videos = videosResponse.items.map((item) =>
      "creatorHandle" in item ? dtoToEntry(item as FeedItemDto).video : (item as Video)
    );
    return {
      creator: mapDbCreator(profileResponse.creator),
      videos,
      lockedCount: videosResponse.lockedCount ?? 0,
      teasers: videosResponse.teasers ?? [],
      isLive: profileResponse.source === "db"
    };
  } catch {
    if (!isDemoContentAllowed()) return null;
    return demoProfileFallback(creatorId, true);
  }
}
