import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { badRequest, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

/**
 * Own-profile management: profile fields, privacy settings, safety settings,
 * interests, blocked users and avatar uploads.
 */
export const profileRoutes = new Hono<AppEnv>();

profileRoutes.use("*", attachUser);

const mockMe = {
  id: "user_me",
  handle: "vuqiro_user",
  displayName: "Vuqiro User",
  bio: "Exploring Vuqiro.",
  avatarUrl: undefined,
  websiteUrl: undefined,
  country: "US",
  language: "en",
  isCreator: false,
  isVerified: false,
  followerCount: 12,
  followingCount: 48,
  videoCount: 0,
  likeCount: 0
};

profileRoutes.get("/me", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ profile: mockMe, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("profiles").select("*").eq("id", profile.id).maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Profile not found");
  return c.json({
    profile: {
      id: data.id,
      handle: data.handle,
      displayName: data.display_name,
      bio: data.bio,
      avatarUrl: data.avatar_url ?? undefined,
      websiteUrl: data.website_url ?? undefined,
      country: data.country ?? undefined,
      language: data.language ?? undefined,
      isCreator: data.is_creator,
      isVerified: data.is_verified,
      followerCount: data.follower_count,
      followingCount: data.following_count,
      videoCount: data.video_count,
      likeCount: Number(data.like_count)
    },
    source: "db"
  });
});

const profilePatch = z.object({
  displayName: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  websiteUrl: z.string().url().nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  language: z.string().min(2).max(8).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional()
});

profileRoutes.patch("/me", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = profilePatch.parse(await c.req.json());
  enforceRateLimit(`profile-update:${profile.id}`, 30, 3_600_000);

  if (!isBackendConfigured()) {
    return c.json({ profile: { ...mockMe, ...body }, source: "mock" });
  }
  const db = getServiceDb()!;
  const patch: Record<string, unknown> = {};
  if (body.displayName !== undefined) patch.display_name = body.displayName;
  if (body.bio !== undefined) patch.bio = body.bio;
  if (body.websiteUrl !== undefined) patch.website_url = body.websiteUrl;
  if (body.country !== undefined) patch.country = body.country;
  if (body.language !== undefined) patch.language = body.language;
  if (body.avatarUrl !== undefined) patch.avatar_url = body.avatarUrl;
  const { error } = await db.from("profiles").update(patch).eq("id", profile.id);
  if (error) throw badRequest(error.message);
  return c.json({ updated: true, source: "db" });
});

/** Signed avatar upload target inside the caller's folder of the avatars bucket. */
profileRoutes.post("/me/avatar-upload", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`avatar-upload:${profile.id}`, 10, 3_600_000);

  if (!isBackendConfigured()) {
    return c.json({
      uploadUrl: "https://mock.vuqiro.local/storage/avatars/upload",
      path: `${profile.id}/avatar.jpg`,
      publicUrl: "https://mock.vuqiro.local/storage/avatars/mock-avatar.jpg",
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const path = `${profile.id}/${randomUUID()}.jpg`;
  const { data, error } = await db.storage.from("avatars").createSignedUploadUrl(path);
  if (error) throw badRequest(`Could not create upload URL: ${error.message}`);
  const { data: publicData } = db.storage.from("avatars").getPublicUrl(path);
  return c.json({ uploadUrl: data.signedUrl, path, publicUrl: publicData.publicUrl, source: "db" });
});

// ---------------------------------------------------------------------------
// Privacy settings
// ---------------------------------------------------------------------------

const defaultSettings = {
  privacyLevel: "public",
  commentPermission: "everyone",
  messagePermission: "followers",
  likedVideosVisibility: "private",
  analyticsOptIn: true,
  personalizedAdsOptIn: false,
  pushEnabled: false,
  emailEnabled: true
};

profileRoutes.get("/me/settings", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ settings: defaultSettings, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data } = await db.from("profile_settings").select("*").eq("profile_id", profile.id).maybeSingle();
  if (!data) {
    return c.json({ settings: defaultSettings, source: "db" });
  }
  return c.json({
    settings: {
      privacyLevel: data.privacy_level,
      commentPermission: data.comment_permission,
      messagePermission: data.message_permission,
      likedVideosVisibility: data.liked_videos_visibility,
      analyticsOptIn: data.analytics_opt_in,
      personalizedAdsOptIn: data.personalized_ads_opt_in,
      pushEnabled: data.push_enabled,
      emailEnabled: data.email_enabled
    },
    source: "db"
  });
});

const settingsBody = z.object({
  privacyLevel: z.enum(["public", "followers", "private"]).optional(),
  commentPermission: z.enum(["everyone", "followers", "no_one"]).optional(),
  messagePermission: z.enum(["everyone", "followers", "no_one"]).optional(),
  likedVideosVisibility: z.enum(["public", "private"]).optional(),
  analyticsOptIn: z.boolean().optional(),
  personalizedAdsOptIn: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional()
});

profileRoutes.put("/me/settings", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = settingsBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ settings: { ...defaultSettings, ...body }, source: "mock" });
  }
  const db = getServiceDb()!;
  const patch: Record<string, unknown> = { profile_id: profile.id };
  if (body.privacyLevel !== undefined) patch.privacy_level = body.privacyLevel;
  if (body.commentPermission !== undefined) patch.comment_permission = body.commentPermission;
  if (body.messagePermission !== undefined) patch.message_permission = body.messagePermission;
  if (body.likedVideosVisibility !== undefined) patch.liked_videos_visibility = body.likedVideosVisibility;
  if (body.analyticsOptIn !== undefined) patch.analytics_opt_in = body.analyticsOptIn;
  if (body.personalizedAdsOptIn !== undefined) patch.personalized_ads_opt_in = body.personalizedAdsOptIn;
  if (body.pushEnabled !== undefined) patch.push_enabled = body.pushEnabled;
  if (body.emailEnabled !== undefined) patch.email_enabled = body.emailEnabled;
  const { error } = await db.from("profile_settings").upsert(patch, { onConflict: "profile_id" });
  if (error) throw badRequest(error.message);

  // Personalized-ads changes are consent events (append-only trail).
  if (body.personalizedAdsOptIn !== undefined) {
    await db.from("consent_events").insert({
      profile_id: profile.id,
      consent_type: "personalized_ads",
      granted: body.personalizedAdsOptIn,
      source: "settings"
    });
  }
  if (body.analyticsOptIn !== undefined) {
    await db.from("consent_events").insert({
      profile_id: profile.id,
      consent_type: "analytics",
      granted: body.analyticsOptIn,
      source: "settings"
    });
  }
  return c.json({ updated: true, source: "db" });
});

// ---------------------------------------------------------------------------
// Safety settings
// ---------------------------------------------------------------------------

const defaultSafety = {
  restrictedMode: false,
  commentFilterLevel: "standard",
  blockedKeywords: [] as string[],
  whoCanMessage: "followers",
  whoCanMention: "everyone"
};

profileRoutes.get("/me/safety-settings", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ settings: defaultSafety, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data } = await db.from("user_safety_settings").select("*").eq("profile_id", profile.id).maybeSingle();
  if (!data) return c.json({ settings: defaultSafety, source: "db" });
  return c.json({
    settings: {
      restrictedMode: data.restricted_mode,
      commentFilterLevel: data.comment_filter_level,
      blockedKeywords: data.blocked_keywords,
      whoCanMessage: data.who_can_message,
      whoCanMention: data.who_can_mention
    },
    source: "db"
  });
});

const safetyBody = z.object({
  restrictedMode: z.boolean().optional(),
  commentFilterLevel: z.enum(["off", "standard", "strict"]).optional(),
  blockedKeywords: z.array(z.string().trim().min(1).max(60)).max(100).optional(),
  whoCanMessage: z.enum(["everyone", "followers", "no_one"]).optional(),
  whoCanMention: z.enum(["everyone", "followers", "no_one"]).optional()
});

profileRoutes.put("/me/safety-settings", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = safetyBody.parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ settings: { ...defaultSafety, ...body }, source: "mock" });
  }
  const db = getServiceDb()!;
  const patch: Record<string, unknown> = { profile_id: profile.id };
  if (body.restrictedMode !== undefined) patch.restricted_mode = body.restrictedMode;
  if (body.commentFilterLevel !== undefined) patch.comment_filter_level = body.commentFilterLevel;
  if (body.blockedKeywords !== undefined) patch.blocked_keywords = body.blockedKeywords;
  if (body.whoCanMessage !== undefined) patch.who_can_message = body.whoCanMessage;
  if (body.whoCanMention !== undefined) patch.who_can_mention = body.whoCanMention;
  const { error } = await db.from("user_safety_settings").upsert(patch, { onConflict: "profile_id" });
  if (error) throw badRequest(error.message);
  return c.json({ updated: true, source: "db" });
});

// ---------------------------------------------------------------------------
// Interests
// ---------------------------------------------------------------------------

profileRoutes.get("/me/interests", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ interests: ["music", "comedy"], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("user_interests").select("interest").eq("profile_id", profile.id);
  if (error) throw badRequest(error.message);
  return c.json({ interests: (data ?? []).map((row) => row.interest), source: "db" });
});

const interestsBody = z.object({
  interests: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(25)
});

/** Replace the caller's interest set (used by onboarding + settings). */
profileRoutes.put("/me/interests", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = interestsBody.parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ interests: body.interests, source: "mock" });
  }
  const db = getServiceDb()!;
  await db.from("user_interests").delete().eq("profile_id", profile.id);
  if (body.interests.length > 0) {
    const { error } = await db
      .from("user_interests")
      .insert(body.interests.map((interest) => ({ profile_id: profile.id, interest })));
    if (error) throw badRequest(error.message);
  }
  return c.json({ interests: body.interests, source: "db" });
});

// ---------------------------------------------------------------------------
// Blocked users
// ---------------------------------------------------------------------------

profileRoutes.get("/me/blocks", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ blocks: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("blocks")
    .select("id, blocked_profile_id, created_at, blocked:profiles!blocks_blocked_profile_id_fkey (handle, display_name, avatar_url)")
    .eq("blocker_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) throw badRequest(error.message);
  return c.json({
    blocks: (data ?? []).map((row) => {
      const blocked = row.blocked as unknown as { handle: string; display_name: string; avatar_url: string | null } | null;
      return {
        id: row.id,
        profileId: row.blocked_profile_id,
        handle: blocked?.handle ?? "unknown",
        displayName: blocked?.display_name ?? "Unknown",
        avatarUrl: blocked?.avatar_url ?? undefined,
        createdAt: row.created_at
      };
    }),
    source: "db"
  });
});

// ---------------------------------------------------------------------------
// Saved / liked videos and following list
// ---------------------------------------------------------------------------

const VIDEO_LIST_SELECT =
  "id, created_at, videos (id, creator_id, caption, hashtags, visibility, status, moderation_status, thumbnail_url, playback_url, like_count, comment_count, share_count, watch_count, duration_seconds, creators (id, verification_status, profiles (handle, display_name)))";

type SavedVideoRow = {
  id: string;
  created_at: string;
  videos: {
    id: string;
    creator_id: string;
    caption: string;
    hashtags: string[];
    visibility: string;
    status: string;
    moderation_status: string;
    thumbnail_url: string | null;
    playback_url: string | null;
    like_count: number;
    comment_count: number;
    share_count: number;
    watch_count: number;
    duration_seconds: number | null;
    creators: {
      id: string;
      verification_status: string;
      profiles: { handle: string; display_name: string } | null;
    } | null;
  } | null;
};

function toOwnedVideoItem(row: SavedVideoRow) {
  const video = row.videos;
  if (!video) return null;
  // Removed/blocked content stays out of personal collections too.
  if (video.status !== "ready" || !["visible", "limited", "age_restricted"].includes(video.moderation_status)) {
    return null;
  }
  const locked = video.visibility !== "public";
  return {
    id: video.id,
    creatorId: video.creator_id,
    creatorHandle: video.creators?.profiles?.handle ?? "unknown",
    creatorDisplayName: video.creators?.profiles?.display_name ?? "Unknown",
    creatorVerified: video.creators?.verification_status === "verified",
    caption: video.caption,
    hashtags: video.hashtags,
    visibility: video.visibility,
    moderationStatus: video.moderation_status,
    thumbnailUrl: video.thumbnail_url ?? undefined,
    playbackUrl: locked ? undefined : (video.playback_url ?? undefined),
    likeCount: video.like_count,
    commentCount: video.comment_count,
    shareCount: video.share_count,
    watchCount: Number(video.watch_count),
    isPremium: locked,
    savedAt: row.created_at
  };
}

profileRoutes.get("/me/saves", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ items: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("saves")
    .select(VIDEO_LIST_SELECT)
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);
  const items = ((data ?? []) as unknown as SavedVideoRow[]).map(toOwnedVideoItem).filter(Boolean);
  return c.json({ items, source: "db" });
});

profileRoutes.get("/me/likes", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ items: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("likes")
    .select(VIDEO_LIST_SELECT)
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);
  const items = ((data ?? []) as unknown as SavedVideoRow[]).map(toOwnedVideoItem).filter(Boolean);
  return c.json({ items, source: "db" });
});

profileRoutes.get("/me/following", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ following: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("follows")
    .select("id, creator_id, created_at, creators (id, verification_status, profiles (handle, display_name, avatar_url, follower_count))")
    .eq("follower_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw badRequest(error.message);
  return c.json({
    following: (data ?? []).map((row) => {
      const creator = row.creators as unknown as {
        id: string;
        verification_status: string;
        profiles: { handle: string; display_name: string; avatar_url: string | null; follower_count: number } | null;
      } | null;
      return {
        creatorId: row.creator_id,
        handle: creator?.profiles?.handle ?? "unknown",
        displayName: creator?.profiles?.display_name ?? "Unknown",
        avatarUrl: creator?.profiles?.avatar_url ?? undefined,
        isVerified: creator?.verification_status === "verified",
        followerCount: creator?.profiles?.follower_count ?? 0,
        followedAt: row.created_at
      };
    }),
    source: "db"
  });
});

// ---------------------------------------------------------------------------
// Recent searches (reuses search_events; no separate history table)
// ---------------------------------------------------------------------------

profileRoutes.get("/me/searches", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ searches: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("search_events")
    .select("query, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);
  const seen = new Set<string>();
  const searches: { query: string; at: string }[] = [];
  for (const row of data ?? []) {
    const normalized = row.query.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    searches.push({ query: row.query, at: row.created_at });
    if (searches.length >= 10) break;
  }
  return c.json({ searches, source: "db" });
});

profileRoutes.delete("/me/searches", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ cleared: true, source: "mock" });
  }
  const db = getServiceDb()!;
  const { error } = await db.from("search_events").delete().eq("profile_id", profile.id);
  if (error) throw badRequest(error.message);
  return c.json({ cleared: true, source: "db" });
});

// ---------------------------------------------------------------------------
// Muted users
// ---------------------------------------------------------------------------

profileRoutes.get("/me/mutes", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ mutes: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("mutes")
    .select("id, muted_profile_id, created_at, muted:profiles!mutes_muted_profile_id_fkey (handle, display_name, avatar_url)")
    .eq("muter_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) throw badRequest(error.message);
  return c.json({
    mutes: (data ?? []).map((row) => {
      const muted = row.muted as unknown as { handle: string; display_name: string; avatar_url: string | null } | null;
      return {
        id: row.id,
        profileId: row.muted_profile_id,
        handle: muted?.handle ?? "unknown",
        displayName: muted?.display_name ?? "Unknown",
        avatarUrl: muted?.avatar_url ?? undefined,
        createdAt: row.created_at
      };
    }),
    source: "db"
  });
});

// ---------------------------------------------------------------------------
// Consent events (onboarding writes these; settings changes above also do)
// ---------------------------------------------------------------------------

const consentBody = z.object({
  consentType: z.enum([
    "terms",
    "privacy",
    "community_guidelines",
    "creator_terms",
    "payout_terms",
    "personalized_ads",
    "analytics",
    "notifications",
    "marketing"
  ]),
  granted: z.boolean(),
  source: z.enum(["onboarding", "settings", "forced_reacceptance", "signup"]).default("settings"),
  documentId: z.string().optional()
});

profileRoutes.post("/me/consents", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = consentBody.parse(await c.req.json());
  enforceRateLimit(`consent:${profile.id}`, 60, 3_600_000);
  if (!isBackendConfigured()) {
    return c.json({ recorded: true, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { error } = await db.from("consent_events").insert({
    profile_id: profile.id,
    consent_type: body.consentType,
    granted: body.granted,
    source: body.source,
    document_id: body.documentId
  });
  if (error) throw badRequest(error.message);
  return c.json({ recorded: true, source: "db" }, 201);
});
