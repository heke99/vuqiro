import type { ID } from "./user";

export type CreatorTierCode = "support" | "plus" | "premium";

export type CreatorVerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type CreatorOnboardingStatus = "not_started" | "in_progress" | "completed";

export type BannerTone = "violet" | "cyan" | "rose" | "amber" | "emerald";

export type Creator = {
  id: ID;
  userId?: ID;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  bannerTone: BannerTone;
  category?: string;
  followerCount: number;
  subscriberCount: number;
  totalLikes: number;
  totalVideos?: number;
  isVerified: boolean;
  verificationStatus?: CreatorVerificationStatus;
  onboardingStatus?: CreatorOnboardingStatus;
  monetizationEnabled?: boolean;
  moderationWarnings?: number;
  coinRevenue?: number;
  subscriptionRevenue?: number;
  tiersEnabled: CreatorTierCode[];
  createdAt?: string;
};
