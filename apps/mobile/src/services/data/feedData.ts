import { useCallback, useEffect, useRef, useState } from "react";
import { mockCreators, mockServedAds, mockVideos } from "@vuqiro/mock-data";
import type { Creator, ServedAd, Video } from "@vuqiro/types";
import { apiFetch, isApiConfigured } from "../api/client";

export type FeedEntry =
  | { kind: "video"; video: Video; creator: Creator }
  | { kind: "ad"; ad: ServedAd };

type FeedItemDto = {
  kind?: "video" | "ad";
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
  promoted?: boolean;
  createdAt?: string;
};

type FeedResponseItem = FeedItemDto | (ServedAd & { kind: "ad" });

export type { FeedItemDto };

export function dtoToEntry(dto: FeedItemDto): { kind: "video"; video: Video; creator: Creator } {
  return {
    kind: "video",
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
      promoted: dto.promoted,
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

function responseItemToEntry(item: FeedResponseItem): FeedEntry {
  if ((item as { kind?: string }).kind === "ad") {
    return { kind: "ad", ad: item as ServedAd };
  }
  return dtoToEntry(item as FeedItemDto);
}

const MOCK_AD_FREQUENCY = 6;

/** Deterministic mock feed with sponsored cards interleaved (dev/test only). */
export function mockFeedEntries(): FeedEntry[] {
  const entries: FeedEntry[] = [];
  let adIndex = 0;
  mockVideos.forEach((video, index) => {
    entries.push({
      kind: "video",
      video,
      creator: mockCreators.find((candidate) => candidate.id === video.creatorId) ?? mockCreators[0]
    });
    if ((index + 1) % MOCK_AD_FREQUENCY === 0 && mockServedAds.length > 0) {
      entries.push({ kind: "ad", ad: mockServedAds[adIndex % mockServedAds.length] });
      adIndex += 1;
    }
  });
  return entries;
}

/**
 * One-shot video feed (hashtag/sound/creator surfaces). Returns video
 * entries only — these surfaces are ad-free.
 */
export async function fetchVideoFeed(path: string): Promise<{ entries: FeedEntry[]; isLive: boolean }> {
  if (!isApiConfigured()) {
    return { entries: [], isLive: false };
  }
  const response = await apiFetch<{ items: FeedResponseItem[]; source: string }>(path);
  const entries = response.items.map(responseItemToEntry).filter((entry) => entry.kind === "video");
  return { entries, isLive: response.source === "db" };
}

/**
 * Loads a feed from the API when configured (cursor-paginated, with
 * server-inserted sponsored entries), otherwise from mock data.
 */
export function useFeed(tab: "for_you" | "following"): {
  entries: FeedEntry[];
  isLive: boolean;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
} {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!isApiConfigured()) {
        setEntries([]);
        setIsLive(false);
        setHasMore(false);
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const path = tab === "for_you" ? "/feed/for-you" : "/feed/following";
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        const response = await apiFetch<{ items: FeedResponseItem[]; nextCursor?: string | null; source: string }>(
          `${path}${query}`
        );
        const mapped = response.items.map(responseItemToEntry);
        setEntries((current) => (append ? [...current, ...mapped] : mapped));
        setIsLive(response.source === "db");
        cursorRef.current = response.nextCursor ?? null;
        setHasMore(Boolean(response.nextCursor));
      } catch {
        if (!append) {
          setEntries([]);
          setIsLive(false);
        }
        setHasMore(false);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    cursorRef.current = null;
    setHasMore(true);
    fetchPage(null, false);
  }, [fetchPage, reloadKey]);

  const loadMore = useCallback(() => {
    if (cursorRef.current && !loadingRef.current) {
      fetchPage(cursorRef.current, true);
    }
  }, [fetchPage]);

  return {
    entries,
    isLive,
    loading,
    hasMore,
    loadMore,
    reload: () => setReloadKey((key) => key + 1)
  };
}
