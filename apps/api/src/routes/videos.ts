import { Hono } from "hono";
import { z } from "zod";
import { mockComments, mockVideos } from "@vuqiro/mock-data";
import { badRequest, notFound } from "../lib/errors";
import { blockedCreatorIds, toFeedDto, visibleVideosQuery, type VideoRow } from "../lib/feedQuery";
import { notifyProfile } from "../lib/notify";
import { preparePlaybackUrl } from "../lib/playback";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const videoRoutes = new Hono<AppEnv>();

videoRoutes.use("*", attachUser);

const idParam = z.string().min(1).max(64);

/**
 * Server-side access check for locked content. The playback URL for gated
 * videos is ONLY ever returned here, after verifying a real entitlement or
 * membership. Client-side state is never trusted.
 */
videoRoutes.get("/:id/access", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    const video = mockVideos.find((candidate) => candidate.id === id);
    if (!video) throw notFound("Video not found");
    const isPublic = video.visibility === "public";
    return c.json({
      access: isPublic,
      reason: isPublic ? "public" : "locked (mock mode has no entitlements)",
      playbackUrl: isPublic ? video.playbackUrl : undefined,
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const { data: video } = await db
    .from("videos")
    .select("id, creator_id, visibility, required_tier, status, moderation_status, playback_url")
    .eq("id", id)
    .maybeSingle();
  if (!video || video.status !== "ready" || !["visible", "limited", "age_restricted"].includes(video.moderation_status)) {
    throw notFound("Video not available");
  }

  if (video.visibility === "public") {
    return c.json({ access: true, reason: "public", playbackUrl: preparePlaybackUrl(video.playback_url), source: "db" });
  }

  // Owner always has access.
  const { data: ownCreator } = await db
    .from("creators")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("id", video.creator_id)
    .maybeSingle();
  if (ownCreator) {
    return c.json({ access: true, reason: "owner", playbackUrl: preparePlaybackUrl(video.playback_url), source: "db" });
  }

  if (video.visibility === "followers_only") {
    const { data: follow } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", profile.id)
      .eq("creator_id", video.creator_id)
      .maybeSingle();
    if (follow) {
      return c.json({ access: true, reason: "follower", playbackUrl: preparePlaybackUrl(video.playback_url), source: "db" });
    }
    return c.json({ access: false, reason: "follow_required", source: "db" }, 403);
  }

  if (video.visibility === "unlock_with_coins") {
    const { data: entitlement } = await db
      .from("creator_membership_entitlements")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("video_id", video.id)
      .is("revoked_at", null)
      .maybeSingle();
    if (entitlement) {
      return c.json({ access: true, reason: "coin_unlock", playbackUrl: preparePlaybackUrl(video.playback_url), source: "db" });
    }
    return c.json({ access: false, reason: "unlock_required", source: "db" }, 403);
  }

  // subscribers_only / premium_tier_only: verify an active membership at the
  // required tier or above.
  const tierRank = { support: 1, plus: 2, premium: 3 } as const;
  const requiredRank = tierRank[(video.required_tier ?? "support") as keyof typeof tierRank];
  const { data: membership } = await db
    .from("creator_memberships")
    .select("tier, status")
    .eq("profile_id", profile.id)
    .eq("creator_id", video.creator_id)
    .in("status", ["active", "grace_period"])
    .maybeSingle();
  if (membership && tierRank[membership.tier as keyof typeof tierRank] >= requiredRank) {
    return c.json({ access: true, reason: "membership", playbackUrl: preparePlaybackUrl(video.playback_url), source: "db" });
  }
  return c.json({ access: false, reason: "subscription_required", source: "db" }, 403);
});

/**
 * Public video metadata by id. Applies the same visibility rules as feeds:
 * locked videos never expose playback here (that requires /:id/access), and
 * removed/blocked/private content 404s.
 */
videoRoutes.get("/:id", async (c) => {
  const id = idParam.parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    const video = mockVideos.find((candidate) => candidate.id === id);
    if (!video) throw notFound("Video not found");
    return c.json({
      video: { ...video, playbackUrl: video.visibility === "public" ? video.playbackUrl : undefined },
      source: "mock"
    });
  }

  const profile = c.get("profile");
  const [hidden, { data, error }] = await Promise.all([
    blockedCreatorIds(profile?.id),
    visibleVideosQuery().eq("id", id).maybeSingle()
  ]);
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Video not found");
  const row = data as unknown as VideoRow;
  if (hidden.has(row.creator_id)) throw notFound("Video not found");
  return c.json({ video: toFeedDto(row), source: "db" });
});

async function toggleRow(table: "likes" | "saves", profileId: string, videoId: string) {
  const db = getServiceDb()!;
  const { data: existing } = await db
    .from(table)
    .select("id")
    .eq("profile_id", profileId)
    .eq("video_id", videoId)
    .maybeSingle();
  if (existing) {
    await db.from(table).delete().eq("id", existing.id);
    return false;
  }
  const { error } = await db.from(table).insert({ profile_id: profileId, video_id: videoId });
  if (error) throw badRequest(error.message);
  return true;
}

videoRoutes.post("/:id/like", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`like:${profile.id}`, 120, 60_000);
  if (!isBackendConfigured()) return c.json({ liked: true, source: "mock" });
  const liked = await toggleRow("likes", profile.id, id);
  return c.json({ liked, source: "db" });
});

videoRoutes.post("/:id/save", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`save:${profile.id}`, 120, 60_000);
  if (!isBackendConfigured()) return c.json({ saved: true, source: "mock" });
  const saved = await toggleRow("saves", profile.id, id);
  return c.json({ saved, source: "db" });
});

/**
 * Not-interested: removes the video from the caller's For You feed and acts
 * as a negative ranking signal. Toggleable (a second call undoes it).
 */
videoRoutes.post("/:id/not-interested", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`not-interested:${profile.id}`, 120, 60_000);
  if (!isBackendConfigured()) return c.json({ notInterested: true, source: "mock" });

  const db = getServiceDb()!;
  const { data: existing } = await db
    .from("video_not_interested")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("video_id", id)
    .maybeSingle();
  if (existing) {
    await db.from("video_not_interested").delete().eq("id", existing.id);
    return c.json({ notInterested: false, source: "db" });
  }
  const { error } = await db.from("video_not_interested").insert({ profile_id: profile.id, video_id: id });
  if (error) throw badRequest(error.message);

  // Negative signal for the ranking engine's recent-events window.
  await db.from("video_events").insert({ video_id: id, profile_id: profile.id, name: "video_skip", value: 1 });
  return c.json({ notInterested: true, source: "db" }, 201);
});

const shareBody = z.object({
  channel: z.enum(["copy_link", "system_sheet", "direct_message", "external"]).default("system_sheet")
});

/** Record a share (updates the video's share counter via trigger). */
videoRoutes.post("/:id/share", async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile");
  enforceRateLimit(`share:${profile?.id ?? "anon"}`, 60, 60_000);
  const body = shareBody.parse(await c.req.json().catch(() => ({})));

  if (!isBackendConfigured()) {
    return c.json({ shared: true, shareUrl: `https://vuqiro.app/v/${id}`, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data: video } = await db.from("videos").select("id, share_count").eq("id", id).maybeSingle();
  if (!video) throw notFound("Video not found");
  const { error } = await db
    .from("shares")
    .insert({ video_id: id, profile_id: profile?.id ?? null, channel: body.channel });
  if (error) throw badRequest(error.message);
  return c.json({ shared: true, shareUrl: `https://vuqiro.app/v/${id}`, shareCount: video.share_count + 1, source: "db" }, 201);
});

const COMMENT_SELECT =
  "id, video_id, author_id, parent_comment_id, text, like_count, reply_count, created_at, profiles!comments_author_id_fkey (handle, display_name)";

function encodeCommentCursor(row: { created_at: string; id: string }): string {
  return Buffer.from(`${row.created_at}|${row.id}`).toString("base64url");
}

function decodeCommentCursor(cursor: string | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Cursor-paginated comments. Pages walk top-level comments newest-first;
 * each page includes the replies for its top-level comments so threads
 * render complete.
 */
videoRoutes.get("/:id/comments", async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "20"), 1), 50);
  const cursor = decodeCommentCursor(c.req.query("cursor") ?? undefined);

  if (!isBackendConfigured()) {
    return c.json({
      comments: mockComments.filter((comment) => comment.videoId === id),
      nextCursor: null,
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  let query = db
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("video_id", id)
    .is("parent_comment_id", null)
    .in("moderation_status", ["visible", "limited"])
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (cursor) query = query.lt("created_at", cursor.createdAt);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);

  const topLevel = (data ?? []).slice(0, limit);
  const nextCursor =
    (data ?? []).length > limit && topLevel.length > 0
      ? encodeCommentCursor(topLevel[topLevel.length - 1] as { created_at: string; id: string })
      : null;

  let replies: typeof topLevel = [];
  if (topLevel.length > 0) {
    const { data: replyRows } = await db
      .from("comments")
      .select(COMMENT_SELECT)
      .eq("video_id", id)
      .in("parent_comment_id", topLevel.map((row) => row.id))
      .in("moderation_status", ["visible", "limited"])
      .order("created_at", { ascending: true })
      .limit(200);
    replies = replyRows ?? [];
  }

  const profile = c.get("profile");
  let blocked = new Set<string>();
  if (profile) {
    const { data: blocks } = await db.from("blocks").select("blocked_profile_id").eq("blocker_id", profile.id);
    blocked = new Set((blocks ?? []).map((row) => row.blocked_profile_id));
  }

  return c.json({
    comments: [...topLevel, ...replies].filter((row) => !blocked.has(row.author_id)),
    nextCursor,
    source: "db"
  });
});

const commentBody = z.object({
  text: z.string().trim().min(1).max(1000)
});

videoRoutes.post("/:id/comments", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`comment:${profile.id}`, 20, 60_000);
  const body = commentBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ comment: { id: `mock_${Date.now()}`, videoId: id, text: body.text }, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("comments")
    .insert({ video_id: id, author_id: profile.id, text: body.text })
    .select("id, video_id, author_id, text, created_at")
    .single();
  if (error) throw badRequest(error.message);

  // Notify the video's creator (unless they commented on their own video).
  const { data: video } = await db.from("videos").select("creator_id, caption").eq("id", id).maybeSingle();
  if (video) {
    const { data: creator } = await db
      .from("creators")
      .select("profile_id")
      .eq("id", video.creator_id)
      .maybeSingle();
    if (creator && creator.profile_id !== profile.id) {
      await notifyProfile({
        profileId: creator.profile_id,
        type: "new_comment",
        title: "New comment",
        body: `@${profile.handle} commented: \u201c${body.text.slice(0, 80)}\u201d`,
        relatedProfileId: profile.id,
        relatedVideoId: id
      });
    }
  }

  return c.json({ comment: data, source: "db" }, 201);
});
