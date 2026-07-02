export type BillingPlatform = "ios" | "android" | "web" | "admin_manual";

export type PackageType =
  | "creator_subscription_tier"
  | "coin_pack"
  | "boost_pack"
  | "platform_premium";

export type PackageStatus =
  | "draft"
  | "pending_store_config"
  | "ready_to_publish"
  | "published"
  | "retired";

export type StoreProductStatus = "missing" | "configured" | "synced" | "approved" | "live" | "error";

export type PurchaseStatus = "pending" | "completed" | "cancelled" | "refunded" | "failed" | "revoked";

export type CreatorMembershipStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "paused"
  | "grace_period";

export type LedgerStatus = "pending" | "payable" | "held" | "paid" | "refunded" | "reversed" | "disputed";

export type StripeConnectStatus = "not_started" | "onboarding_started" | "active" | "restricted" | "disabled";

export type PayoutStatus = "pending" | "held" | "payable" | "processing" | "paid" | "failed";

export type MonetizationPackage = {
  id: string;
  code: string;
  name: string;
  type: PackageType;
  status: PackageStatus;
};

export type MonetizationPackageVersion = {
  id: string;
  packageId: string;
  version: number;
  displayName: string;
  description: string;
  priceAmount: number;
  currency: string;
  billingPeriod: "one_time" | "monthly" | "yearly";
  coinsAmount?: number;
  bonusCoinsAmount?: number;
  platformFeePercent: number;
  creatorSharePercent: number;
  status: PackageStatus;
};

export type StoreProduct = {
  id: string;
  packageVersionId: string;
  platform: BillingPlatform;
  storeProductId: string;
  revenueCatOfferingId?: string;
  revenueCatEntitlementId?: string;
  status: StoreProductStatus;
};
