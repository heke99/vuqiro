export type ID = string;

export type Visibility =
  | "public"
  | "followers_only"
  | "subscribers_only"
  | "premium_tier_only"
  | "unlock_with_coins"
  | "private";

export type CreatorTierCode = "support" | "plus" | "premium";

export type Creator = {
  id: ID;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  bannerTone: "violet" | "cyan" | "rose" | "amber" | "emerald";
  followerCount: number;
  subscriberCount: number;
  totalLikes: number;
  isVerified: boolean;
  tiersEnabled: CreatorTierCode[];
};

export type Video = {
  id: ID;
  creatorId: ID;
  caption: string;
  hashtags: string[];
  visibility: Visibility;
  requiredTier?: CreatorTierCode;
  coinUnlockPrice?: number;
  playbackUrl?: string;
  thumbnailUrl?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  watchCount: number;
  isPremium: boolean;
  safetyScore: number;
};

export type WalletTransaction = {
  id: ID;
  type: "purchase" | "tip" | "unlock" | "boost" | "adjustment";
  amount: number;
  label: string;
  createdAt: string;
};
