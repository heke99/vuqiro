import type { ID } from "./user";
import type { CreatorTierCode } from "./creator";
import type { ModerationStatus } from "./moderation";

export type Visibility =
  | "public"
  | "followers_only"
  | "subscribers_only"
  | "premium_tier_only"
  | "unlock_with_coins"
  | "private";

export type VideoStatus =
  | "draft"
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "under_review"
  | "rejected"
  | "removed"
  | "blocked"
  | "deleted";

export type Video = {
  id: ID;
  creatorId: ID;
  caption: string;
  hashtags: string[];
  category?: string;
  visibility: Visibility;
  status?: VideoStatus;
  moderationStatus?: ModerationStatus;
  requiredTier?: CreatorTierCode;
  coinUnlockPrice?: number;
  playbackUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount?: number;
  watchCount: number;
  reportCount?: number;
  revenue?: number;
  isPremium: boolean;
  safetyScore: number;
  createdAt?: string;
};

export type VideoAsset = {
  id: ID;
  videoId: ID;
  provider: "mux" | "mock";
  providerAssetId: string;
  providerUploadId?: string;
  status: "waiting_for_upload" | "processing" | "ready" | "errored" | "deleted";
  playbackUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  createdAt: string;
};
