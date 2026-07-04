import type { ID } from "./user";

export type AdvertiserStatus = "active" | "suspended" | "archived";

export type Advertiser = {
  id: ID;
  name: string;
  legalName: string;
  contactEmail: string;
  contactName: string;
  websiteUrl?: string;
  country?: string;
  status: AdvertiserStatus;
  notes: string;
  createdAt: string;
};

export type AdAccountStatus = "active" | "suspended" | "closed";

export type AdAccount = {
  id: ID;
  advertiserId: ID;
  name: string;
  currency: string;
  balanceCents: number;
  status: AdAccountStatus;
  createdAt: string;
};

export type AdCampaignStatus = "draft" | "pending_review" | "active" | "paused" | "completed" | "rejected";
export type AdBuyingType = "cpm" | "cpc" | "cpa" | "fixed_sponsorship";
export type AdObjective = "awareness" | "traffic" | "conversions" | "installs";
export type AdPlacement = "feed" | "discover" | "profile" | "inbox" | "post_roll";

export type AdCampaign = {
  id: ID;
  adAccountId: ID;
  advertiserId: ID;
  name: string;
  objective: AdObjective;
  buyingType: AdBuyingType;
  status: AdCampaignStatus;
  totalBudgetCents?: number;
  dailyBudgetCents?: number;
  spentCents: number;
  cpmPriceCents?: number;
  cpcPriceCents?: number;
  cpaPriceCents?: number;
  fixedPriceCents?: number;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
};

export type AdGroupStatus = "active" | "paused" | "archived";

export type AdTargeting = {
  countries?: string[];
  languages?: string[];
  interests?: string[];
  minAge?: number;
};

export type AdGroup = {
  id: ID;
  campaignId: ID;
  name: string;
  status: AdGroupStatus;
  placements: AdPlacement[];
  targeting: AdTargeting;
  frequencyCapPerDay: number;
  createdAt: string;
};

export type AdCreativeType = "video" | "image" | "card";
export type AdCreativeReviewStatus = "pending" | "approved" | "rejected";

export type AdCreative = {
  id: ID;
  adGroupId: ID;
  campaignId: ID;
  type: AdCreativeType;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  videoId?: ID;
  reviewStatus: AdCreativeReviewStatus;
  reviewNote?: string;
  status: AdGroupStatus;
  createdAt: string;
};

export type DirectSponsorshipStatus = "draft" | "active" | "completed" | "cancelled";

export type DirectSponsorshipDeal = {
  id: ID;
  advertiserId: ID;
  campaignId?: ID;
  name: string;
  description: string;
  fixedPriceCents: number;
  currency: string;
  status: DirectSponsorshipStatus;
  startsAt?: string;
  endsAt?: string;
  invoiceReference?: string;
  createdAt: string;
};

export type PlatformRevenueSource =
  | "coin_purchase"
  | "subscription"
  | "boost"
  | "premium_unlock_fee"
  | "ad_revenue"
  | "sponsorship"
  | "adjustment"
  | "refund";

export type PlatformRevenueEntry = {
  id: ID;
  source: PlatformRevenueSource;
  referenceType: string;
  referenceId?: ID;
  amountCents: number;
  currency: string;
  description: string;
  occurredAt: string;
};

export type AdReportReason =
  | "misleading"
  | "offensive"
  | "scam"
  | "adult_content"
  | "dangerous_product"
  | "irrelevant"
  | "other";

/** The ad payload delivered to clients inside a feed. */
export type ServedAd = {
  kind: "ad";
  creativeId: ID;
  campaignId: ID;
  adGroupId: ID;
  advertiserName: string;
  type: AdCreativeType;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  placement: AdPlacement;
};
