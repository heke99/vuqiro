import { Hono } from "hono";
import { z } from "zod";
import { mockComments, mockVideos } from "@vuqiro/mock-data";
import { badRequest, notFound } from "../lib/errors";
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
    return c.json({ access: true, reason: "public", playbackUrl: video.playback_url, source: "db" });
  }

  // Owner always has access.
  const { data: ownCreator } = await db
    .from("creators")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("id", video.creator_id)
    .maybeSingle();
  if (ownCreator) {
    return c.json({ access: true, reason: "owner", playbackUrl: video.playback_url, source: "db" });
  }

  if (video.visibility === "followers_only") {
    const { data: follow } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", profile.id)
      .eq("creator_id", video.creator_id)
      .maybeSingle();
    if (follow) {
      return c.json({ access: true, reason: "follower", playbackUrl: video.playback_url, source: "db" });
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
      return c.json({ access: true, reason: "coin_unlock", playbackUrl: video.playback_url, source: "db" });
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
    return c.json({ access: true, reason: "membership", playbackUrl: video.playback_url, source: "db" });
  }
  return c.json({ access: false, reason: "subscription_required", source: "db" }, 403);
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

videoRoutes.get("/:id/comments", async (c) => {
  const id = idParam.parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    return c.json({ comments: mockComments.filter((comment) => comment.videoId === id), source: "mock" });
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("comments")
    .select("id, video_id, author_id, parent_comment_id, text, like_count, reply_count, created_at, profiles!comments_author_id_fkey (handle, display_name)")
    .eq("video_id", id)
    .in("moderation_status", ["visible", "limited"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);

  const profile = c.get("profile");
  let blocked = new Set<string>();
  if (profile) {
    const { data: blocks } = await db.from("blocks").select("blocked_profile_id").eq("blocker_id", profile.id);
    blocked = new Set((blocks ?? []).map((row) => row.blocked_profile_id));
  }

  return c.json({
    comments: (data ?? []).filter((row) => !blocked.has(row.author_id)),
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
  return c.json({ comment: data, source: "db" }, 201);
});
