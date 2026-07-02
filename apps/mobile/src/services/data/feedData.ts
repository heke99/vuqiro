import { useEffect, useState } from "react";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import type { Creator, Video } from "@vuqiro/types";
import { apiFetch, isApiConfigured } from "../api/client";

export type FeedEntry = { video: Video; creator: Creator };

type FeedItemDto = {
  id: string;
  creatorId: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorVerified: boolean;
  caption: string;
  hashtags: string[];
  category?: string;
  visibility: Video["visibility"];
  moderationStatus?: Video["moderationStatus"];
  coinUnlockPrice?: number;
  requiredTier?: Video["requiredTier"];
  playbackUrl?: string;
  thumbnailUrl?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  watchCount: number;
  isPremium: boolean;
  createdAt?: string;
};

function dtoToEntry(dto: FeedItemDto): FeedEntry {
  return {
    video: {
      id: dto.id,
      creatorId: dto.creatorId,
      caption: dto.caption,
      hashtags: dto.hashtags,
      category: dto.category,
      visibility: dto.visibility,
      status: "ready",
      moderationStatus: dto.moderationStatus ?? "visible",
      coinUnlockPrice: dto.coinUnlockPrice,
      requiredTier: dto.requiredTier,
      playbackUrl: dto.playbackUrl,
      thumbnailUrl: dto.thumbnailUrl,
      likeCount: dto.likeCount,
      commentCount: dto.commentCount,
      shareCount: dto.shareCount,
      watchCount: dto.watchCount,
      isPremium: dto.isPremium,
      safetyScore: 100,
      createdAt: dto.createdAt
    },
    creator: {
      id: dto.creatorId,
      handle: dto.creatorHandle,
      displayName: dto.creatorDisplayName,
      bio: "",
      bannerTone: "violet",
      followerCount: 0,
      subscriberCount: 0,
      totalLikes: 0,
      isVerified: dto.creatorVerified,
      tiersEnabled: ["support", "plus", "premium"]
    }
  };
}

export function mockFeedEntries(): FeedEntry[] {
  return mockVideos.map((video) => ({
    video,
    creator: mockCreators.find((candidate) => candidate.id === video.creatorId) ?? mockCreators[0]
  }));
}

/**
 * Loads a feed from the API when configured, otherwise from mock data.
 * Falls back to mocks on request failure so the feed never dies.
 */
export function useFeed(tab: "for_you" | "following"): {
  entries: FeedEntry[];
  isLive: boolean;
  reload: () => void;
} {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isApiConfigured()) {
        if (!cancelled) {
          setEntries([]);
          setIsLive(false);
        }
        return;
      }
      try {
        const path = tab === "for_you" ? "/feed/for-you" : "/feed/following";
        const response = await apiFetch<{ items: FeedItemDto[]; source: string }>(path);
        if (!cancelled) {
          setEntries(response.items.map(dtoToEntry));
          setIsLive(response.source === "db");
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setIsLive(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  return { entries, isLive, reload: () => setReloadKey((key) => key + 1) };
}
