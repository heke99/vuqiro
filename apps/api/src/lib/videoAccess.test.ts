import { describe, expect, it } from "vitest";
import {
  anonymousViewer,
  canGeneratePlaybackUrl,
  canManageVideo,
  canModerateVideo,
  canViewVideo,
  decideVideoAccess,
  getVisibleVideosForViewer,
  isListable,
  loadViewerContext,
  type AccessVideo,
  type ViewerContext
} from "./videoAccess";

// Pure access-matrix tests. These are the single source of truth for who can
// see what; the route-level tests then verify every surface actually calls
// these rules.

function video(overrides: Partial<AccessVideo> = {}): AccessVideo {
  return {
    id: "v1",
    creatorId: "creator_a",
    visibility: "public",
    status: "ready",
    moderationStatus: "visible",
    requiredTier: null,
    ...overrides
  };
}

function viewer(overrides: Partial<ViewerContext> = {}): ViewerContext {
  return { ...anonymousViewer(), ...overrides };
}

const freeViewer = viewer({ profileId: "user_free" });
const memberOfA = viewer({
  profileId: "user_member_a",
  membershipTierByCreator: new Map([["creator_a", "support"]])
});
const memberOfB = viewer({
  profileId: "user_member_b",
  membershipTierByCreator: new Map([["creator_b", "premium"]])
});
const followerOfA = viewer({ profileId: "user_follower", followedCreatorIds: new Set(["creator_a"]) });
const ownerOfA = viewer({ profileId: "user_owner", ownCreatorIds: new Set(["creator_a"]) });
const admin = viewer({ profileId: "user_admin", isAdmin: true });

describe("public videos", () => {
  const publicVideo = video();

  it("are viewable by anonymous viewers", () => {
    expect(canViewVideo(anonymousViewer(), publicVideo)).toBe(true);
  });

  it("are viewable by logged-in free users", () => {
    expect(canViewVideo(freeViewer, publicVideo)).toBe(true);
  });

  it("are viewable by members, owners and admins", () => {
    expect(canViewVideo(memberOfA, publicVideo)).toBe(true);
    expect(canViewVideo(ownerOfA, publicVideo)).toBe(true);
    expect(canViewVideo(admin, publicVideo)).toBe(true);
  });

  it("allow playback URL generation for everyone", () => {
    expect(canGeneratePlaybackUrl(anonymousViewer(), publicVideo)).toBe(true);
  });
});

describe("members-only videos (subscribers_only / premium_tier_only)", () => {
  const membersOnly = video({ visibility: "subscribers_only" });

  it("are hidden from anonymous and free viewers", () => {
    expect(canViewVideo(anonymousViewer(), membersOnly)).toBe(false);
    expect(decideVideoAccess(freeViewer, membersOnly)).toEqual({
      allowed: false,
      reason: "subscription_required"
    });
  });

  it("are viewable by a member of that exact creator", () => {
    expect(decideVideoAccess(memberOfA, membersOnly)).toEqual({ allowed: true, reason: "membership" });
  });

  it("are NOT viewable by a member of a different creator", () => {
    expect(canViewVideo(memberOfB, membersOnly)).toBe(false);
    expect(canViewVideo(memberOfB, video({ id: "vb", creatorId: "creator_b", visibility: "subscribers_only" }))).toBe(
      true
    );
  });

  it("respect the required tier ranking", () => {
    const premiumOnly = video({ visibility: "premium_tier_only", requiredTier: "premium" });
    expect(canViewVideo(memberOfA, premiumOnly)).toBe(false); // support < premium
    const premiumMemberOfA = viewer({
      profileId: "x",
      membershipTierByCreator: new Map([["creator_a", "premium"]])
    });
    expect(canViewVideo(premiumMemberOfA, premiumOnly)).toBe(true);
    expect(canViewVideo(premiumMemberOfA, video({ visibility: "subscribers_only", requiredTier: "support" }))).toBe(
      true
    );
  });

  it("do not grant access for lapsed statuses (context only contains granting statuses)", () => {
    // loadViewerContext only loads active/grace_period memberships, so an
    // expired/cancelled/paused membership never reaches the context.
    expect(canViewVideo(freeViewer, membersOnly)).toBe(false);
  });

  it("are viewable by the owning creator and by admins", () => {
    expect(decideVideoAccess(ownerOfA, membersOnly)).toEqual({ allowed: true, reason: "owner" });
    expect(decideVideoAccess(admin, membersOnly)).toEqual({ allowed: true, reason: "admin" });
  });

  it("honor creator-scoped grants", () => {
    const granted = viewer({ profileId: "x", grantedCreatorIds: new Set(["creator_a"]) });
    expect(decideVideoAccess(granted, membersOnly)).toEqual({ allowed: true, reason: "grant" });
  });
});

describe("followers-only videos", () => {
  const followersOnly = video({ visibility: "followers_only" });

  it("are hidden from anonymous viewers and non-followers", () => {
    expect(canViewVideo(anonymousViewer(), followersOnly)).toBe(false);
    expect(decideVideoAccess(freeViewer, followersOnly)).toEqual({ allowed: false, reason: "follow_required" });
  });

  it("are viewable by followers, owner and admin", () => {
    expect(decideVideoAccess(followerOfA, followersOnly)).toEqual({ allowed: true, reason: "follower" });
    expect(canViewVideo(ownerOfA, followersOnly)).toBe(true);
    expect(canViewVideo(admin, followersOnly)).toBe(true);
  });
});

describe("coin-unlock videos", () => {
  const coinVideo = video({ visibility: "unlock_with_coins" });

  it("are locked without an entitlement", () => {
    expect(decideVideoAccess(freeViewer, coinVideo)).toEqual({ allowed: false, reason: "unlock_required" });
  });

  it("unlock with an unrevoked per-video entitlement", () => {
    const unlocked = viewer({ profileId: "x", unlockedVideoIds: new Set(["v1"]) });
    expect(decideVideoAccess(unlocked, coinVideo)).toEqual({ allowed: true, reason: "coin_unlock" });
    expect(canViewVideo(unlocked, video({ id: "v2", visibility: "unlock_with_coins" }))).toBe(false);
  });
});

describe("private videos", () => {
  const privateVideo = video({ visibility: "private" });

  it("are only visible to owner and admin", () => {
    expect(canViewVideo(anonymousViewer(), privateVideo)).toBe(false);
    expect(canViewVideo(freeViewer, privateVideo)).toBe(false);
    expect(canViewVideo(memberOfA, privateVideo)).toBe(false);
    expect(canViewVideo(followerOfA, privateVideo)).toBe(false);
    expect(decideVideoAccess(ownerOfA, privateVideo)).toEqual({ allowed: true, reason: "owner" });
    expect(decideVideoAccess(admin, privateVideo)).toEqual({ allowed: true, reason: "admin" });
  });

  it("never allow playback URL generation for normal users", () => {
    expect(canGeneratePlaybackUrl(memberOfA, privateVideo)).toBe(false);
  });
});

describe("lifecycle and moderation states", () => {
  it("hides non-ready videos from everyone but owner/admin", () => {
    for (const status of ["draft", "uploading", "processing", "under_review", "rejected", "removed", "blocked", "deleted"]) {
      const row = video({ status });
      expect(canViewVideo(freeViewer, row), status).toBe(false);
      expect(canViewVideo(memberOfA, row), status).toBe(false);
      expect(canViewVideo(ownerOfA, row), status).toBe(true);
      expect(canViewVideo(admin, row), status).toBe(true);
    }
  });

  it("hides moderation-hidden videos from normal viewers", () => {
    for (const moderation of ["removed", "blocked", "under_review", "payout_hold"]) {
      const row = video({ moderationStatus: moderation });
      expect(canViewVideo(freeViewer, row), moderation).toBe(false);
      expect(decideVideoAccess(freeViewer, row).reason, moderation).toBe("unavailable");
    }
  });

  it("keeps visible/limited/age_restricted listable", () => {
    for (const moderation of ["visible", "limited", "age_restricted"]) {
      expect(isListable(video({ moderationStatus: moderation })), moderation).toBe(true);
    }
  });

  it("treats missing status/moderation (mock DTOs) as ready/visible", () => {
    expect(isListable({ status: undefined, moderationStatus: undefined })).toBe(true);
  });
});

describe("management and moderation permissions", () => {
  it("canManageVideo is owner-or-admin", () => {
    expect(canManageVideo(ownerOfA, video())).toBe(true);
    expect(canManageVideo(admin, video())).toBe(true);
    expect(canManageVideo(memberOfA, video())).toBe(false);
    expect(canManageVideo(freeViewer, video())).toBe(false);
  });

  it("canModerateVideo follows RBAC roles", () => {
    expect(canModerateVideo("platform_superadmin")).toBe(true);
    expect(canModerateVideo("admin")).toBe(true);
    expect(canModerateVideo("moderator")).toBe(true);
    expect(canModerateVideo("finance")).toBe(false);
    expect(canModerateVideo("support")).toBe(false);
    expect(canModerateVideo(undefined)).toBe(false);
  });
});

describe("getVisibleVideosForViewer", () => {
  const catalog = [
    video({ id: "pub" }),
    video({ id: "members", visibility: "subscribers_only" }),
    video({ id: "priv", visibility: "private" }),
    video({ id: "removed", moderationStatus: "removed" })
  ];

  it("filters to public only for anonymous viewers", () => {
    expect(getVisibleVideosForViewer(anonymousViewer(), catalog).map((v) => v.id)).toEqual(["pub"]);
  });

  it("includes members-only for the right member", () => {
    expect(getVisibleVideosForViewer(memberOfA, catalog).map((v) => v.id)).toEqual(["pub", "members"]);
  });

  it("includes everything except nothing for admins", () => {
    expect(getVisibleVideosForViewer(admin, catalog).map((v) => v.id)).toEqual([
      "pub",
      "members",
      "priv",
      "removed"
    ]);
  });
});

describe("loadViewerContext (mock mode)", () => {
  it("returns the empty context for anonymous viewers", async () => {
    const context = await loadViewerContext(undefined);
    expect(context.profileId).toBeUndefined();
    expect(context.membershipTierByCreator.size).toBe(0);
    expect(context.isAdmin).toBe(false);
  });

  it("loads memberships/entitlements for the default mock user", async () => {
    const context = await loadViewerContext("user_me");
    expect(context.membershipTierByCreator.get("creator_001")).toBe("plus");
    expect(context.membershipTierByCreator.get("creator_004")).toBe("support");
    // grace_period grants access (deliberate business rule)
    expect(context.membershipTierByCreator.get("creator_007")).toBe("premium");
    // cancelled must NOT grant access
    expect(context.membershipTierByCreator.has("creator_008")).toBe(false);
    expect(context.unlockedVideoIds.has("video_002")).toBe(true);
    expect(context.grantedCreatorIds.has("creator_001")).toBe(true);
  });

  it("maps scenario members to their exact creator", async () => {
    const contextA = await loadViewerContext("user_member_a");
    expect(contextA.membershipTierByCreator.get("creator_003")).toBe("support");
    expect(contextA.membershipTierByCreator.has("creator_005")).toBe(false);

    const contextB = await loadViewerContext("user_member_b");
    expect(contextB.membershipTierByCreator.get("creator_005")).toBe("plus");
    expect(contextB.membershipTierByCreator.has("creator_003")).toBe(false);
  });

  it("does not load expired memberships", async () => {
    const context = await loadViewerContext("user_expired_member");
    expect(context.membershipTierByCreator.size).toBe(0);
  });

  it("resolves creator ownership from mock creators", async () => {
    const context = await loadViewerContext("user_003");
    expect(context.ownCreatorIds.has("creator_003")).toBe(true);
  });
});
