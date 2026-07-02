import type { MonetizationPackage, MonetizationPackageVersion, StoreProduct } from "@vuqiro/types";

export const mockPackages: MonetizationPackage[] = [
  { id: "pkg_support", code: "creator_support", name: "Creator Support", type: "creator_subscription_tier", status: "published" },
  { id: "pkg_plus", code: "creator_plus", name: "Creator Plus", type: "creator_subscription_tier", status: "published" },
  { id: "pkg_premium", code: "creator_premium", name: "Creator Premium", type: "creator_subscription_tier", status: "published" },
  { id: "pkg_coins_100", code: "coins_100", name: "100 Coins", type: "coin_pack", status: "published" },
  { id: "pkg_coins_500", code: "coins_500", name: "500 Coins", type: "coin_pack", status: "published" },
  { id: "pkg_coins_1200", code: "coins_1200", name: "1,200 Coins", type: "coin_pack", status: "published" },
  { id: "pkg_coins_5000", code: "coins_5000", name: "5,000 Coins", type: "coin_pack", status: "published" },
  { id: "pkg_boost_small", code: "boost_small", name: "Small Boost", type: "boost_pack", status: "ready_to_publish" },
  { id: "pkg_boost_growth", code: "boost_growth", name: "Growth Boost", type: "boost_pack", status: "pending_store_config" },
  { id: "pkg_boost_launch", code: "boost_launch", name: "Launch Boost", type: "boost_pack", status: "draft" }
];

export const mockPackageVersions: MonetizationPackageVersion[] = [
  { id: "ver_support_1", packageId: "pkg_support", version: 1, displayName: "Creator Support", description: "Supporter badge and basic locked posts.", priceAmount: 2.99, currency: "USD", billingPeriod: "monthly", platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_plus_1", packageId: "pkg_plus", version: 1, displayName: "Creator Plus", description: "Premium videos and early drops.", priceAmount: 5.99, currency: "USD", billingPeriod: "monthly", platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_premium_1", packageId: "pkg_premium", version: 1, displayName: "Creator Premium", description: "Exclusive drops and priority interaction.", priceAmount: 9.99, currency: "USD", billingPeriod: "monthly", platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_100_1", packageId: "pkg_coins_100", version: 1, displayName: "100 Coins", description: "Small starter coin pack.", priceAmount: 1.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 100, platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_500_1", packageId: "pkg_coins_500", version: 1, displayName: "500 Coins", description: "Most popular starter pack.", priceAmount: 7.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 500, bonusCoinsAmount: 25, platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_1200_1", packageId: "pkg_coins_1200", version: 1, displayName: "1,200 Coins", description: "More coins for active supporters.", priceAmount: 14.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 1200, bonusCoinsAmount: 100, platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_coins_5000_1", packageId: "pkg_coins_5000", version: 1, displayName: "5,000 Coins", description: "Large creator support pack.", priceAmount: 49.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 5000, bonusCoinsAmount: 700, platformFeePercent: 20, creatorSharePercent: 80, status: "published" },
  { id: "ver_boost_small_1", packageId: "pkg_boost_small", version: 1, displayName: "Small Boost", description: "Boost a video to a wider audience.", priceAmount: 4.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 250, platformFeePercent: 100, creatorSharePercent: 0, status: "ready_to_publish" },
  { id: "ver_boost_growth_1", packageId: "pkg_boost_growth", version: 1, displayName: "Growth Boost", description: "Larger reach boost for growing creators.", priceAmount: 14.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 900, platformFeePercent: 100, creatorSharePercent: 0, status: "pending_store_config" },
  { id: "ver_boost_launch_1", packageId: "pkg_boost_launch", version: 1, displayName: "Launch Boost", description: "Maximum launch-week exposure.", priceAmount: 39.99, currency: "USD", billingPeriod: "one_time", coinsAmount: 2600, platformFeePercent: 100, creatorSharePercent: 0, status: "draft" }
];

const iosPrefix = "com.diversasolutions.vuqiro";

export const mockStoreProducts: StoreProduct[] = [
  { id: "store_001", packageVersionId: "ver_support_1", platform: "ios", storeProductId: `${iosPrefix}.creator.support.monthly`, revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_support", status: "configured" },
  { id: "store_002", packageVersionId: "ver_plus_1", platform: "ios", storeProductId: `${iosPrefix}.creator.plus.monthly`, revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_plus", status: "configured" },
  { id: "store_003", packageVersionId: "ver_premium_1", platform: "ios", storeProductId: `${iosPrefix}.creator.premium.monthly`, revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_premium", status: "configured" },
  { id: "store_004", packageVersionId: "ver_support_1", platform: "android", storeProductId: `${iosPrefix}.creator.support.monthly`, revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_support", status: "configured" },
  { id: "store_005", packageVersionId: "ver_plus_1", platform: "android", storeProductId: `${iosPrefix}.creator.plus.monthly`, revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_plus", status: "configured" },
  { id: "store_006", packageVersionId: "ver_premium_1", platform: "android", storeProductId: `${iosPrefix}.creator.premium.monthly`, revenueCatOfferingId: "creator_memberships", revenueCatEntitlementId: "creator_premium", status: "missing" },
  { id: "store_007", packageVersionId: "ver_coins_100_1", platform: "ios", storeProductId: `${iosPrefix}.coins.100`, revenueCatOfferingId: "coins", status: "configured" },
  { id: "store_008", packageVersionId: "ver_coins_500_1", platform: "ios", storeProductId: `${iosPrefix}.coins.500`, revenueCatOfferingId: "coins", status: "configured" },
  { id: "store_009", packageVersionId: "ver_coins_1200_1", platform: "ios", storeProductId: `${iosPrefix}.coins.1200`, revenueCatOfferingId: "coins", status: "configured" },
  { id: "store_010", packageVersionId: "ver_coins_5000_1", platform: "ios", storeProductId: `${iosPrefix}.coins.5000`, revenueCatOfferingId: "coins", status: "missing" },
  { id: "store_011", packageVersionId: "ver_coins_100_1", platform: "android", storeProductId: `${iosPrefix}.coins.100`, revenueCatOfferingId: "coins", status: "configured" },
  { id: "store_012", packageVersionId: "ver_coins_500_1", platform: "android", storeProductId: `${iosPrefix}.coins.500`, revenueCatOfferingId: "coins", status: "configured" },
  { id: "store_013", packageVersionId: "ver_coins_1200_1", platform: "android", storeProductId: `${iosPrefix}.coins.1200`, revenueCatOfferingId: "coins", status: "missing" },
  { id: "store_014", packageVersionId: "ver_coins_5000_1", platform: "android", storeProductId: `${iosPrefix}.coins.5000`, revenueCatOfferingId: "coins", status: "missing" },
  { id: "store_015", packageVersionId: "ver_boost_small_1", platform: "ios", storeProductId: `${iosPrefix}.boost.small`, revenueCatOfferingId: "boosts", status: "missing" },
  { id: "store_016", packageVersionId: "ver_boost_growth_1", platform: "ios", storeProductId: `${iosPrefix}.boost.growth`, revenueCatOfferingId: "boosts", status: "missing" },
  { id: "store_017", packageVersionId: "ver_boost_launch_1", platform: "ios", storeProductId: `${iosPrefix}.boost.launch`, revenueCatOfferingId: "boosts", status: "missing" }
];
