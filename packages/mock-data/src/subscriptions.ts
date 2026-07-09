import type { ContentEntitlement, CreatorMembership } from "@vuqiro/types";

export const mockMemberships: CreatorMembership[] = [
  {
    id: "member_001",
    userId: "user_me",
    creatorId: "creator_001",
    tier: "plus",
    status: "active",
    platform: "ios",
    storeProductId: "com.diversasolutions.vuqiro.creator.plus.monthly",
    startedAt: "2026-05-01T00:00:00Z",
    renewsAt: "2026-08-01T00:00:00Z"
  },
  {
    id: "member_002",
    userId: "user_me",
    creatorId: "creator_004",
    tier: "support",
    status: "active",
    platform: "ios",
    storeProductId: "com.diversasolutions.vuqiro.creator.support.monthly",
    startedAt: "2026-06-10T00:00:00Z",
    renewsAt: "2026-07-10T00:00:00Z"
  },
  {
    id: "member_003",
    userId: "user_me",
    creatorId: "creator_007",
    tier: "premium",
    status: "grace_period",
    platform: "android",
    storeProductId: "com.diversasolutions.vuqiro.creator.premium.monthly",
    startedAt: "2026-04-15T00:00:00Z",
    renewsAt: "2026-07-05T00:00:00Z"
  },
  {
    id: "member_004",
    userId: "user_me",
    creatorId: "creator_008",
    tier: "support",
    status: "cancelled",
    platform: "ios",
    storeProductId: "com.diversasolutions.vuqiro.creator.support.monthly",
    startedAt: "2026-03-01T00:00:00Z",
    cancelledAt: "2026-06-01T00:00:00Z",
    expiresAt: "2026-07-01T00:00:00Z"
  },
  // Access-scenario fixtures: member of creator A (creator_003) and member of
  // creator B (creator_005). Used by the video-access regression tests to
  // prove membership is creator-specific.
  {
    id: "member_test_a",
    userId: "user_member_a",
    creatorId: "creator_003",
    tier: "support",
    status: "active",
    platform: "ios",
    storeProductId: "com.diversasolutions.vuqiro.creator.support.monthly",
    startedAt: "2026-06-01T00:00:00Z",
    renewsAt: "2026-08-01T00:00:00Z"
  },
  {
    id: "member_test_b",
    userId: "user_member_b",
    creatorId: "creator_005",
    tier: "plus",
    status: "active",
    platform: "android",
    storeProductId: "com.diversasolutions.vuqiro.creator.plus.monthly",
    startedAt: "2026-06-01T00:00:00Z",
    renewsAt: "2026-08-01T00:00:00Z"
  },
  // Expired membership fixture: must NOT grant access.
  {
    id: "member_test_expired",
    userId: "user_expired_member",
    creatorId: "creator_003",
    tier: "premium",
    status: "expired",
    platform: "ios",
    storeProductId: "com.diversasolutions.vuqiro.creator.premium.monthly",
    startedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2026-05-01T00:00:00Z"
  }
];

export const mockEntitlements: ContentEntitlement[] = [
  { id: "ent_001", userId: "user_me", videoId: "video_002", source: "coin_unlock", grantedAt: "2026-06-29T20:00:00Z" },
  { id: "ent_002", userId: "user_me", videoId: "video_009", source: "coin_unlock", grantedAt: "2026-06-16T12:40:00Z" },
  { id: "ent_003", userId: "user_me", videoId: "video_019", source: "coin_unlock", grantedAt: "2026-06-23T21:10:00Z" },
  { id: "ent_004", userId: "user_me", creatorId: "creator_001", source: "membership", grantedAt: "2026-05-01T00:00:00Z" }
];

/** Follow fixtures (viewer profile id -> followed creator). Drives the mock
 * following feed and followers_only access checks. */
export const mockFollows: { userId: string; creatorId: string }[] = [
  { userId: "user_me", creatorId: "creator_001" },
  { userId: "user_me", creatorId: "creator_002" },
  { userId: "user_me", creatorId: "creator_004" },
  { userId: "user_member_a", creatorId: "creator_003" },
  { userId: "user_follower", creatorId: "creator_002" }
];
