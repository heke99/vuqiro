import { mockCreators, mockEntitlements, mockFollows, mockMemberships } from "@vuqiro/mock-data";
import { getServiceDb, isBackendConfigured } from "./supabase";

/**
 * Central video access control.
 *
 * Every surface that returns videos or media (feeds, search, trending,
 * hashtag/sound pages, creator profiles, video detail, playback access,
 * engagement endpoints) must go through these rules instead of duplicating
 * visibility checks. The same rules run in mock mode (against
 * `@vuqiro/mock-data`) and in DB mode (against Supabase), and are mirrored
 * by the `public.can_view_video` RLS policy for direct table access.
 *
 * Access matrix (in evaluation order):
 *   - admins/moderators (with proper RBAC role) can view everything
 *   - the owning creator can view their own videos in any state
 *   - non-listable videos (not ready, or moderation-hidden) are invisible
 *   - `public`           -> everyone, including anonymous viewers
 *   - `followers_only`   -> active followers of the creator
 *   - `subscribers_only` /
 *     `premium_tier_only`-> an active or grace_period membership for that
 *                           exact creator at the required tier or above.
 *                           Deliberate business rule: `grace_period` keeps
 *                           access during billing retries; `cancelled`,
 *                           `expired` and `paused` do NOT grant access.
 *   - `unlock_with_coins`-> an unrevoked per-video coin entitlement
 *   - creator-scoped unrevoked entitlements (`admin_grant`/`membership`
 *     rows with a creator_id) unlock that creator's gated videos
 *   - `private`          -> owner and admins only
 */

export type TierCode = "support" | "plus" | "premium";

const TIER_RANK: Record<TierCode, number> = { support: 1, plus: 2, premium: 3 };

const LISTABLE_MODERATION = new Set(["visible", "limited", "age_restricted"]);

const MEMBERSHIP_ACCESS_STATUSES = ["active", "grace_period"] as const;

/** Minimal video shape the access rules need. Both the DB row (mapped) and
 * the mock/DTO camelCase shapes satisfy it. */
export type AccessVideo = {
  id: string;
  creatorId: string;
  visibility: string;
  status?: string | null;
  moderationStatus?: string | null;
  requiredTier?: string | null;
};

export type ViewerContext = {
  profileId?: string;
  /** Creator ids owned by the viewer (creators.profile_id = viewer). */
  ownCreatorIds: ReadonlySet<string>;
  followedCreatorIds: ReadonlySet<string>;
  /** creatorId -> tier for memberships in an access-granting status. */
  membershipTierByCreator: ReadonlyMap<string, TierCode>;
  /** Videos unlocked with coins (unrevoked entitlements). */
  unlockedVideoIds: ReadonlySet<string>;
  /** Creator-wide unrevoked entitlements (admin grants etc.). */
  grantedCreatorIds: ReadonlySet<string>;
  /** True only for RBAC-verified admin/moderator callers. */
  isAdmin: boolean;
};

export function anonymousViewer(): ViewerContext {
  return {
    profileId: undefined,
    ownCreatorIds: new Set(),
    followedCreatorIds: new Set(),
    membershipTierByCreator: new Map(),
    unlockedVideoIds: new Set(),
    grantedCreatorIds: new Set(),
    isAdmin: false
  };
}

function mockViewerContext(profileId: string): ViewerContext {
  const memberships = new Map<string, TierCode>();
  for (const membership of mockMemberships) {
    if (
      membership.userId === profileId &&
      (MEMBERSHIP_ACCESS_STATUSES as readonly string[]).includes(membership.status)
    ) {
      memberships.set(membership.creatorId, membership.tier);
    }
  }
  const unlocked = new Set<string>();
  const granted = new Set<string>();
  for (const entitlement of mockEntitlements) {
    if (entitlement.userId !== profileId || entitlement.revokedAt) continue;
    if (entitlement.videoId) unlocked.add(entitlement.videoId);
    if (entitlement.creatorId) granted.add(entitlement.creatorId);
  }
  return {
    profileId,
    ownCreatorIds: new Set(mockCreators.filter((creator) => creator.userId === profileId).map((c) => c.id)),
    followedCreatorIds: new Set(
      mockFollows.filter((follow) => follow.userId === profileId).map((follow) => follow.creatorId)
    ),
    membershipTierByCreator: memberships,
    unlockedVideoIds: unlocked,
    grantedCreatorIds: granted,
    isAdmin: false
  };
}

/**
 * Loads everything the access rules need about a viewer in one batch.
 * Anonymous viewers get the empty context. In mock mode the context is
 * derived from the deterministic mock fixtures so the same rules are
 * exercised without a database.
 */
export async function loadViewerContext(
  profileId: string | undefined,
  options: { isAdmin?: boolean } = {}
): Promise<ViewerContext> {
  const isAdmin = options.isAdmin === true;
  if (!profileId) return { ...anonymousViewer(), isAdmin };

  if (!isBackendConfigured()) {
    return { ...mockViewerContext(profileId), isAdmin };
  }

  const db = getServiceDb()!;
  const [{ data: ownCreators }, { data: follows }, { data: memberships }, { data: entitlements }] =
    await Promise.all([
      db.from("creators").select("id").eq("profile_id", profileId),
      db.from("follows").select("creator_id").eq("follower_id", profileId),
      db
        .from("creator_memberships")
        .select("creator_id, tier")
        .eq("profile_id", profileId)
        .in("status", [...MEMBERSHIP_ACCESS_STATUSES]),
      db
        .from("creator_membership_entitlements")
        .select("video_id, creator_id")
        .eq("profile_id", profileId)
        .is("revoked_at", null)
    ]);

  const membershipTierByCreator = new Map<string, TierCode>();
  for (const membership of memberships ?? []) {
    const tier = membership.tier as TierCode;
    const existing = membershipTierByCreator.get(membership.creator_id);
    if (!existing || TIER_RANK[tier] > TIER_RANK[existing]) {
      membershipTierByCreator.set(membership.creator_id, tier);
    }
  }
  const unlockedVideoIds = new Set<string>();
  const grantedCreatorIds = new Set<string>();
  for (const entitlement of entitlements ?? []) {
    if (entitlement.video_id) unlockedVideoIds.add(entitlement.video_id);
    if (entitlement.creator_id) grantedCreatorIds.add(entitlement.creator_id);
  }

  return {
    profileId,
    ownCreatorIds: new Set((ownCreators ?? []).map((row) => row.id)),
    followedCreatorIds: new Set((follows ?? []).map((row) => row.creator_id)),
    membershipTierByCreator,
    unlockedVideoIds,
    grantedCreatorIds,
    isAdmin
  };
}

/** True when a video is in a publicly listable lifecycle/moderation state. */
export function isListable(video: Pick<AccessVideo, "status" | "moderationStatus">): boolean {
  const status = video.status ?? "ready";
  const moderation = video.moderationStatus ?? "visible";
  return status === "ready" && LISTABLE_MODERATION.has(moderation);
}

export type AccessReason =
  | "admin"
  | "owner"
  | "public"
  | "follower"
  | "membership"
  | "coin_unlock"
  | "grant"
  | "unavailable"
  | "follow_required"
  | "subscription_required"
  | "unlock_required"
  | "private";

export type AccessDecision = { allowed: boolean; reason: AccessReason };

function membershipSatisfies(viewer: ViewerContext, video: AccessVideo): boolean {
  const tier = viewer.membershipTierByCreator.get(video.creatorId);
  if (!tier) return false;
  const required = (video.requiredTier ?? "support") as TierCode;
  return TIER_RANK[tier] >= (TIER_RANK[required] ?? TIER_RANK.support);
}

/** The single authoritative access decision for one viewer and one video. */
export function decideVideoAccess(viewer: ViewerContext, video: AccessVideo): AccessDecision {
  if (viewer.isAdmin) return { allowed: true, reason: "admin" };
  if (viewer.ownCreatorIds.has(video.creatorId)) return { allowed: true, reason: "owner" };
  if (!isListable(video)) return { allowed: false, reason: "unavailable" };

  switch (video.visibility) {
    case "public":
      return { allowed: true, reason: "public" };
    case "followers_only":
      if (viewer.followedCreatorIds.has(video.creatorId)) return { allowed: true, reason: "follower" };
      if (viewer.grantedCreatorIds.has(video.creatorId)) return { allowed: true, reason: "grant" };
      return { allowed: false, reason: "follow_required" };
    case "subscribers_only":
    case "premium_tier_only":
      if (membershipSatisfies(viewer, video)) return { allowed: true, reason: "membership" };
      if (viewer.grantedCreatorIds.has(video.creatorId)) return { allowed: true, reason: "grant" };
      return { allowed: false, reason: "subscription_required" };
    case "unlock_with_coins":
      if (viewer.unlockedVideoIds.has(video.id)) return { allowed: true, reason: "coin_unlock" };
      if (viewer.grantedCreatorIds.has(video.creatorId)) return { allowed: true, reason: "grant" };
      return { allowed: false, reason: "unlock_required" };
    case "private":
    default:
      return { allowed: false, reason: "private" };
  }
}

export function canViewVideo(viewer: ViewerContext, video: AccessVideo): boolean {
  return decideVideoAccess(viewer, video).allowed;
}

/** Playback follows viewing: a playback URL may only be generated for a
 * viewer who is allowed to view the video. */
export function canGeneratePlaybackUrl(viewer: ViewerContext, video: AccessVideo): boolean {
  return decideVideoAccess(viewer, video).allowed;
}

/** Owner-or-admin management access (edit, delete, studio views). */
export function canManageVideo(viewer: ViewerContext, video: Pick<AccessVideo, "creatorId">): boolean {
  return viewer.isAdmin || viewer.ownCreatorIds.has(video.creatorId);
}

/** RBAC roles allowed to act on any video in moderation surfaces. */
export function canModerateVideo(adminRole: string | undefined): boolean {
  return adminRole === "platform_superadmin" || adminRole === "admin" || adminRole === "moderator";
}

/**
 * Filters a list of videos down to what the viewer may see. Used by every
 * listing surface BEFORE ranking so unauthorized content never enters the
 * ranking pipeline.
 */
export function getVisibleVideosForViewer<T extends AccessVideo>(viewer: ViewerContext, videos: T[]): T[] {
  return videos.filter((video) => canViewVideo(viewer, video));
}
