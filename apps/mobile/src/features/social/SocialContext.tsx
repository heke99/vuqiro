import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { trackEvent } from "../video/videoEvents";

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
  isFollowing: (creatorId: string) => boolean;
  isBlocked: (userId: string) => boolean;
  isLiked: (videoId: string) => boolean;
  isSaved: (videoId: string) => boolean;
  toggleFollow: (creatorId: string) => void;
  toggleBlock: (userId: string) => void;
  toggleLike: (videoId: string, creatorId?: string) => void;
  toggleSave: (videoId: string, creatorId?: string) => void;
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

  const toggleFollow = useCallback((creatorId: string) => {
    setFollowed((current) => {
      if (!current.has(creatorId)) trackEvent("creator_follow", { creatorId });
      return toggleInSet(current, creatorId);
    });
  }, []);

  const toggleBlock = useCallback((userId: string) => {
    setBlocked((current) => {
      if (!current.has(userId)) trackEvent("block_user", { creatorId: userId });
      return toggleInSet(current, userId);
    });
  }, []);

  const toggleLike = useCallback((videoId: string, creatorId?: string) => {
    setLiked((current) => {
      if (!current.has(videoId)) trackEvent("video_like", { videoId, creatorId });
      return toggleInSet(current, videoId);
    });
  }, []);

  const toggleSave = useCallback((videoId: string, creatorId?: string) => {
    setSaved((current) => {
      if (!current.has(videoId)) trackEvent("video_save", { videoId, creatorId });
      return toggleInSet(current, videoId);
    });
  }, []);

  const value = useMemo<SocialState>(
    () => ({
      followedCreatorIds,
      blockedUserIds,
      likedVideoIds,
      savedVideoIds,
      isFollowing: (creatorId) => followedCreatorIds.has(creatorId),
      isBlocked: (userId) => blockedUserIds.has(userId),
      isLiked: (videoId) => likedVideoIds.has(videoId),
      isSaved: (videoId) => savedVideoIds.has(videoId),
      toggleFollow,
      toggleBlock,
      toggleLike,
      toggleSave
    }),
    [followedCreatorIds, blockedUserIds, likedVideoIds, savedVideoIds, toggleFollow, toggleBlock, toggleLike, toggleSave]
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
