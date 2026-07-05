import { apiFetch, isApiConfigured } from "../api/client";

/** Personal collections: saved videos, liked videos, following list. */

export type CollectionVideo = {
  id: string;
  creatorId: string;
  creatorHandle: string;
  creatorDisplayName: string;
  caption: string;
  thumbnailUrl?: string;
  watchCount: number;
  likeCount: number;
  isPremium: boolean;
};

export type FollowedCreator = {
  creatorId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  isVerified: boolean;
  followerCount: number;
};

export async function fetchSavedVideos(): Promise<CollectionVideo[]> {
  if (!isApiConfigured()) return [];
  const response = await apiFetch<{ items: CollectionVideo[] }>("/me/saves");
  return response.items;
}

export async function fetchLikedVideos(): Promise<CollectionVideo[]> {
  if (!isApiConfigured()) return [];
  const response = await apiFetch<{ items: CollectionVideo[] }>("/me/likes");
  return response.items;
}

export async function fetchFollowing(): Promise<FollowedCreator[]> {
  if (!isApiConfigured()) return [];
  const response = await apiFetch<{ following: FollowedCreator[] }>("/me/following");
  return response.following;
}
