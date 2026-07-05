import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { apiFetch, isApiConfigured } from "../../services/api/client";
import { trackEvent } from "../video/videoEvents";

/** Fire-and-forget backend sync; UI state is optimistic. */
function syncToApi(path: string, body?: Record<string, unknown>): void {
  if (!isApiConfigured()) return;
  apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : "{}" }).catch((error) => {
    console.warn(`[social] sync failed for ${path}:`, error?.message ?? error);
  });
}

/**
 * Session-level social graph state (follows, blocks, likes, saves).
 * Backed by local state until the backend batches persist it; the same
 * interface is kept so screens don't change when real APIs arrive.
 */
type SocialState = {
  followedCreatorIds: ReadonlySet<string>;
  blockedUserIds: ReadonlySet<string>;
  likedVideoIds: ReadonlySet<string>;
  savedVideoIds: ReadonlySet<string>;
  mutedUserIds: ReadonlySet<string>;
  notInterestedVideoIds: ReadonlySet<string>;
  isFollowing: (creatorId: string) => boolean;
  isBlocked: (userId: string) => boolean;
  isLiked: (videoId: string) => boolean;
  isSaved: (videoId: string) => boolean;
  isMuted: (userId: string) => boolean;
  isNotInterested: (videoId: string) => boolean;
  toggleFollow: (creatorId: string) => void;
  toggleBlock: (userId: string) => void;
  toggleLike: (videoId: string, creatorId?: string) => void;
  toggleSave: (videoId: string, creatorId?: string) => void;
  /** Mutes by creator id (resolved to a profile server-side). */
  toggleMute: (creatorId: string) => void;
  markNotInterested: (videoId: string) => void;
};

const SocialContext = createContext<SocialState | null>(null);

function toggleInSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [followedCreatorIds, setFollowed] = useState<ReadonlySet<string>>(new Set());
  const [blockedUserIds, setBlocked] = useState<ReadonlySet<string>>(new Set());
  const [likedVideoIds, setLiked] = useState<ReadonlySet<string>>(new Set());
  const [savedVideoIds, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [mutedUserIds, setMuted] = useState<ReadonlySet<string>>(new Set());
  const [notInterestedVideoIds, setNotInterested] = useState<ReadonlySet<string>>(new Set());

  const toggleFollow = useCallback((creatorId: string) => {
    setFollowed((current) => {
      if (!current.has(creatorId)) trackEvent("creator_follow", { creatorId });
      return toggleInSet(current, creatorId);
    });
    syncToApi(`/creators/${creatorId}/follow`);
  }, []);

  const toggleBlock = useCallback((userId: string) => {
    setBlocked((current) => {
      if (!current.has(userId)) trackEvent("block_user", { creatorId: userId });
      return toggleInSet(current, userId);
    });
    syncToApi("/blocks", { blockedProfileId: userId });
  }, []);

  const toggleLike = useCallback((videoId: string, creatorId?: string) => {
    setLiked((current) => {
      if (!current.has(videoId)) trackEvent("video_like", { videoId, creatorId });
      return toggleInSet(current, videoId);
    });
    syncToApi(`/videos/${videoId}/like`);
  }, []);

  const toggleSave = useCallback((videoId: string, creatorId?: string) => {
    setSaved((current) => {
      if (!current.has(videoId)) trackEvent("video_save", { videoId, creatorId });
      return toggleInSet(current, videoId);
    });
    syncToApi(`/videos/${videoId}/save`);
  }, []);

  const toggleMute = useCallback((creatorId: string) => {
    setMuted((current) => toggleInSet(current, creatorId));
    syncToApi("/mutes", { creatorId });
  }, []);

  const markNotInterested = useCallback((videoId: string) => {
    setNotInterested((current) => {
      if (!current.has(videoId)) trackEvent("video_skip", { videoId });
      return toggleInSet(current, videoId);
    });
    syncToApi(`/videos/${videoId}/not-interested`);
  }, []);

  const value = useMemo<SocialState>(
    () => ({
      followedCreatorIds,
      blockedUserIds,
      likedVideoIds,
      savedVideoIds,
      mutedUserIds,
      notInterestedVideoIds,
      isFollowing: (creatorId) => followedCreatorIds.has(creatorId),
      isBlocked: (userId) => blockedUserIds.has(userId),
      isLiked: (videoId) => likedVideoIds.has(videoId),
      isSaved: (videoId) => savedVideoIds.has(videoId),
      isMuted: (userId) => mutedUserIds.has(userId),
      isNotInterested: (videoId) => notInterestedVideoIds.has(videoId),
      toggleFollow,
      toggleBlock,
      toggleLike,
      toggleSave,
      toggleMute,
      markNotInterested
    }),
    [
      followedCreatorIds,
      blockedUserIds,
      likedVideoIds,
      savedVideoIds,
      mutedUserIds,
      notInterestedVideoIds,
      toggleFollow,
      toggleBlock,
      toggleLike,
      toggleSave,
      toggleMute,
      markNotInterested
    ]
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialState {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error("useSocial must be used inside SocialProvider");
  }
  return context;
}
