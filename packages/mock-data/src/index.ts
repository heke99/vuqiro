import type {
  Creator,
  Video,
  WalletTransaction,
  MonetizationPackage,
  MonetizationPackageVersion,
  StoreProduct,
  ModerationCase
} from "@vuqiro/types";

export const mockCreators: Creator[] = [
  {
    id: "creator_001",
    handle: "maya",
    displayName: "Maya North",
    bio: "Daily edits, music moments and creator drops.",
    bannerTone: "violet",
    followerCount: 128400,
    subscriberCount: 4200,
    totalLikes: 890000,
    isVerified: true,
    tiersEnabled: ["support", "plus", "premium"]
  },
  {
    id: "creator_002",
    handle: "riven",
    displayName: "Riven Atlas",
    bio: "Travel cuts, city nights and behind-the-scenes stories.",
    bannerTone: "cyan",
    followerCount: 84200,
    subscriberCount: 1800,
    totalLikes: 420000,
    isVerified: true,
    tiersEnabled: ["support", "plus"]
  },
  {
    id: "creator_003",
    handle: "noorbuilds",
    displayName: "Noor Builds",
    bio: "Creator tools, app building and product breakdowns.",
    bannerTone: "emerald",
    followerCount: 36100,
    subscriberCount: 920,
    totalLikes: 156000,
    isVerified: false,
    tiersEnabled: ["support"]
  }
];

export const mockVideos: Video[] = [
  {
    id: "video_001",
    creatorId: "creator_001",
    caption: "A quick moment from tonight’s session.",
    hashtags: ["music", "studio", "creator"],
    visibility: "public",
    likeCount: 12400,
    commentCount: 382,
    shareCount: 910,
    watchCount: 210000,
    isPremium: false,
    safetyScore: 94
  },
  {
    id: "video_002",
    creatorId: "creator_002",
    caption: "City lights, fast cuts, no filter.",
    hashtags: ["travel", "night", "cinematic"],
    visibility: "unlock_with_coins",
    coinUnlockPrice: 100,
    likeCount: 7900,
    commentCount: 144,
    shareCount: 410,
    watchCount: 84000,
    isPremium: true,
    safetyScore: 91
  },
  {
    id: "video_003",
    creatorId: "creator_003",
    caption: "The simplest way to structure a creator app MVP.",
    hashtags: ["build", "startup", "tech"],
    visibility: "subscribers_only",
    requiredTier: "support",
    likeCount: 2200,
    commentCount: 91,
    shareCount: 88,
    watchCount: 22000,
    isPremium: true,
    safetyScore: 97
  }
];

export const mockWalletTransactions: WalletTransaction[] = [
  { id: "txn_001", type: "purchase", amount: 500, label: "500 coins pack", createdAt: "2026-07-02" },
  { id: "txn_002", type: "tip", amount: -100, label: "Supported Maya North", createdAt: "2026-07-02" },
  { id: "txn_003", type: "unlock", amount: -50, label: "Unlocked premium video", createdAt: "2026-07-01" }
];

export const mockPackages: MonetizationPackage[] = [
  { id: "pkg_support", code: "creator_support", name: "Creator Support", type: "creator_subscription_tier", status: "published" },
  { id: "pkg_plus", code: "creator_plus", name: "Creator Plus", type: "creator_subscription_tier", status: "published" },
  { id: "pkg_premium", code: "creator_premium", name: "Creator Premium", type: "creator_subscription_tier", status: "published" },
  { id: "pkg_coins_100", code: "coins_100", name: "100 Coins", type: "coin_pack", status: "published" },
  { id: "pkg_coins_500", code: "coins_500", name: "500 Coins", type: "coin_pack", status: "published" },
  { id: "pkg_coins_1200", code: "coins_1200", name: "1,200 Coins", type: "coin_pack", status: "published" },
  { id: "pkg_coins_5000", code: "coins_5000", name: "5,000 Coins", type: "coin_pack", status: "published" }
];

export const mockPackageVersions: MonetizationPackageVersion[] = [
  { id: "ver_support_1", packageId: "pkg_support", version: 1, displayName: "Creator Support", description: "Supporter badge and basic locked posts.", priceAmount: 2.99, currency: "USD", billingPeriod: "monthly", platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_plus_1", packageId: "pkg_plus", version: 1, displayName: "Creator Plus", description: "Premium videos and early drops.", priceAmount: 5.99, currency: "USD", billingPeriod: "monthly", platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_premium_1", packageId: "pkg_premium", version: 1, displayName: "Creator Premium", description: "Exclusive drops and priority interaction.", priceAmount: 9.99, currency: "USD", billingPeriod: "monthly", platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_100_1", packageId: "pkg_coins_100", version: 1, displayName: "100 Coins", description: "Small starter coin pack.", priceAmount: 1.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 100, platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_500_1", packageId: "pkg_coins_500", version: 1, displayName: "500 Coins", description: "Most popular starter pack.", priceAmount: 7.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 500, bonusCoinsAmount: 25, platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_1200_1", packageId: "pkg_coins_1200", version: 1, displayName: "1,200 Coins", description: "More coins for active supporters.", priceAmount: 14.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 1200, bonusCoinsAmount: 100, platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_5000_1", packageId: "pkg_coins_5000", version: 1, displayName: "5,000 Coins", description: "Large creator support pack.", priceAmount: 49.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 5000, bonusCoinsAmount: 700, platformFeePercent: 20, creatorSharePercent: 80, status: "published" }
];

export const mockStoreProducts: StoreProduct[] = [
  { id: "store_001", packageVersionId: "ver_support_1", platform: "ios", storeProductId: "com.diversasolutions.vuqiro.creator.support.monthly", revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_support", status: "configured" },
  { id: "store_002", packageVersionId: "ver_plus_1", platform: "ios", storeProductId: "com.diversasolutions.vuqiro.creator.plus.monthly", revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_plus", status: "configured" },
  { id: "store_003", packageVersionId: "ver_premium_1", platform: "ios", storeProductId: "com.diversasolutions.vuqiro.creator.premium.monthly", revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_premium", status: "configured" },
  { id: "store_004", packageVersionId: "ver_coins_100_1", platform: "android", storeProductId: "com.diversasolutions.vuqiro.coins.100", revenueCatOfferingId: "coins", status: "missing" }
];

export const mockModerationCases: ModerationCase[] = [
  { id: "mod_001", targetType: "video", targetId: "video_002", reason: "copyright", status: "reviewing", priority: "medium", createdAt: "2026-07-02" },
  { id: "mod_002", targetType: "profile", targetId: "creator_003", reason: "spam", status: "open", priority: "low", createdAt: "2026-07-01" }
];

export const mockAdminMetrics = {
  totalUsers: 18240,
  totalCreators: 1240,
  activeCreators: 842,
  uploadedVideos: 92100,
  videosUnderReview: 42,
  reportedContent: 18,
  activeSubscriptions: 5600,
  coinRevenue: 24800,
  pendingPayouts: 11400,
  heldPayouts: 2200,
  refunds: 31
};
