import type { ID } from "./user";
import type { CreatorTierCode } from "./creator";
import type { BillingPlatform, CreatorMembershipStatus } from "./payments";

export type CreatorMembership = {
  id: ID;
  userId: ID;
  creatorId: ID;
  tier: CreatorTierCode;
  status: CreatorMembershipStatus;
  platform: BillingPlatform;
  storeProductId?: string;
  startedAt: string;
  renewsAt?: string;
  cancelledAt?: string;
  expiresAt?: string;
};

export type ContentEntitlement = {
  id: ID;
  userId: ID;
  videoId?: ID;
  creatorId?: ID;
  source: "membership" | "coin_unlock" | "admin_grant";
  grantedAt: string;
  revokedAt?: string;
};
