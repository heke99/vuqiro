import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import { apiFetch, isApiConfigured } from "../api/client";
import { isDemoContentAllowed } from "./demoMode";

/**
 * Discover/search data service. Live API when configured; deterministic demo
 * data only in non-production builds without an API.
 */

export type DiscoverCreator = {
  id: string;
  handle: string;
  displayName: string;
  isVerified: boolean;
  category?: string;
  followerCount: number;
  subscriberCount: number;
  monetizationEnabled: boolean;
  createdAt?: string;
};

export type DiscoverVideo = {
  id: string;
  caption: string;
  watchCount: number;
  category?: string;
  isPremium: boolean;
  thumbnailUrl?: string;
};

export type DiscoverCategory = { id: string; slug: string; label: string };

export type TrendingData = {
  trendingCreators: DiscoverCreator[];
  premiumCreators: DiscoverCreator[];
  newCreators: DiscoverCreator[];
  trendingHashtags: string[];
  topVideos: DiscoverVideo[];
  isLive: boolean;
};

export type SearchResults = {
  creators: DiscoverCreator[];
  videos: DiscoverVideo[];
  hashtags: string[];
  isLive: boolean;
};

function mockCreatorToDiscover(creator: (typeof mockCreators)[number]): DiscoverCreator {
  return {
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    isVerified: creator.isVerified,
    category: creator.category,
    followerCount: creator.followerCount,
    subscriberCount: creator.subscriberCount,
    monetizationEnabled: creator.monetizationEnabled ?? false,
    createdAt: creator.createdAt
  };
}

function mockVideoToDiscover(video: (typeof mockVideos)[number]): DiscoverVideo {
  return {
    id: video.id,
    caption: video.caption,
    watchCount: video.watchCount,
    category: video.category,
    isPremium: video.isPremium,
    thumbnailUrl: video.thumbnailUrl
  };
}

function mockTrending(): TrendingData {
  const creators = mockCreators.map(mockCreatorToDiscover);
  const hashtagCounts = new Map<string, number>();
  for (const video of mockVideos) {
    for (const tag of video.hashtags) {
      hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + video.watchCount);
    }
  }
  return {
    trendingCreators: [...creators].sort((a, b) => b.followerCount - a.followerCount).slice(0, 6),
    premiumCreators: creators.filter((creator) => creator.monetizationEnabled).slice(0, 4),
    newCreators: [...creators].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 3),
    trendingHashtags: [...hashtagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag),
    topVideos: [...mockVideos]
      .filter((video) => video.visibility === "public")
      .sort((a, b) => b.watchCount - a.watchCount)
      .slice(0, 5)
      .map(mockVideoToDiscover),
    isLive: false
  };
}

const EMPTY_TRENDING: TrendingData = {
  trendingCreators: [],
  premiumCreators: [],
  newCreators: [],
  trendingHashtags: [],
  topVideos: [],
  isLive: false
};

export async function fetchTrending(): Promise<TrendingData> {
  if (!isApiConfigured()) {
    return isDemoContentAllowed() ? mockTrending() : EMPTY_TRENDING;
  }
  try {
    const response = await apiFetch<{
      trendingCreators: DiscoverCreator[];
      premiumCreators: DiscoverCreator[];
      newCreators: DiscoverCreator[];
      trendingHashtags: string[];
      topVideos: (DiscoverVideo & { watchCount?: number })[];
      source: string;
    }>("/discover/trending");
    return {
      trendingCreators: response.trendingCreators ?? [],
      premiumCreators: response.premiumCreators ?? [],
      newCreators: response.newCreators ?? [],
      trendingHashtags: response.trendingHashtags ?? [],
      topVideos: (response.topVideos ?? []).map((video) => ({ ...video, watchCount: video.watchCount ?? 0 })),
      isLive: response.source === "db"
    };
  } catch {
    return isDemoContentAllowed() ? mockTrending() : EMPTY_TRENDING;
  }
}

function mockSearch(term: string): SearchResults {
  const creators = mockCreators
    .filter(
      (creator) =>
        creator.handle.toLowerCase().includes(term) ||
        creator.displayName.toLowerCase().includes(term) ||
        (creator.category ?? "").toLowerCase().includes(term)
    )
    .map(mockCreatorToDiscover);
  const videos = mockVideos
    .filter(
      (video) =>
        video.caption.toLowerCase().includes(term) ||
        (video.category ?? "").toLowerCase().includes(term) ||
        video.hashtags.some((tag) => tag.toLowerCase().includes(term))
    )
    .map(mockVideoToDiscover);
  const hashtags = [...new Set(mockVideos.flatMap((video) => video.hashtags))].filter((tag) =>
    tag.includes(term)
  );
  return { creators, videos, hashtags, isLive: false };
}

export async function searchAll(query: string): Promise<SearchResults> {
  const term = query.trim().toLowerCase().replace(/^#/, "");
  if (!term) return { creators: [], videos: [], hashtags: [], isLive: false };
  if (!isApiConfigured()) {
    return isDemoContentAllowed()
      ? mockSearch(term)
      : { creators: [], videos: [], hashtags: [], isLive: false };
  }
  try {
    const response = await apiFetch<{
      creators: DiscoverCreator[];
      videos: DiscoverVideo[];
      hashtags: string[];
      source: string;
    }>(`/search?q=${encodeURIComponent(term)}`);
    return {
      creators: response.creators ?? [],
      videos: response.videos ?? [],
      hashtags: response.hashtags ?? [],
      isLive: response.source === "db"
    };
  } catch {
    return isDemoContentAllowed() ? mockSearch(term) : { creators: [], videos: [], hashtags: [], isLive: false };
  }
}

const FALLBACK_CATEGORIES = ["Music", "Travel", "Tech", "Fitness", "Art", "Food", "Fashion", "Gaming"];

export async function fetchCategories(): Promise<DiscoverCategory[]> {
  const fallback = FALLBACK_CATEGORIES.map((label) => ({
    id: label.toLowerCase(),
    slug: label.toLowerCase(),
    label
  }));
  if (!isApiConfigured()) return fallback;
  try {
    const response = await apiFetch<{ categories: DiscoverCategory[] }>("/categories");
    return response.categories.length > 0 ? response.categories : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchRecentSearches(): Promise<string[]> {
  if (!isApiConfigured()) return [];
  try {
    const response = await apiFetch<{ searches: { query: string }[] }>("/me/searches");
    return response.searches.map((search) => search.query);
  } catch {
    return [];
  }
}

export async function clearRecentSearches(): Promise<void> {
  if (!isApiConfigured()) return;
  try {
    await apiFetch("/me/searches", { method: "DELETE" });
  } catch {
    // best-effort
  }
}
