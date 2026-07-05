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

export async function fetchCreatorProfile(
  creatorId: string
): Promise<{ creator: Creator; videos: Video[]; isLive: boolean } | null> {
  if (!isApiConfigured()) {
    if (!isDemoContentAllowed()) return null;
    const creator = mockCreators.find((candidate) => candidate.id === creatorId) ?? mockCreators[0];
    return {
      creator,
      videos: mockVideos.filter((video) => video.creatorId === creator.id),
      isLive: false
    };
  }
  try {
    const [profileResponse, videosResponse] = await Promise.all([
      apiFetch<DbCreatorResponse>(`/creators/${creatorId}`),
      apiFetch<{ items: (FeedItemDto | Video)[]; source: string }>(`/creators/${creatorId}/videos`)
    ]);
    const videos = videosResponse.items.map((item) =>
      "creatorHandle" in item ? dtoToEntry(item as FeedItemDto).video : (item as Video)
    );
    return {
      creator: mapDbCreator(profileResponse.creator),
      videos,
      isLive: profileResponse.source === "db"
    };
  } catch {
    if (!isDemoContentAllowed()) return null;
    const creator = mockCreators.find((candidate) => candidate.id === creatorId);
    if (!creator) return null;
    return { creator, videos: mockVideos.filter((video) => video.creatorId === creator.id), isLive: false };
  }
}
