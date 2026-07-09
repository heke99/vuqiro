import { Hono } from "hono";
import { z } from "zod";
import { mockComments, mockVideos } from "@vuqiro/mock-data";
import { badRequest, notFound } from "../lib/errors";
import { blockedCreatorIds, rowToAccessVideo, toFeedDto, VIDEO_SELECT, type VideoRow } from "../lib/feedQuery";
import { notifyProfile } from "../lib/notify";
import { preparePlaybackUrl } from "../lib/playback";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import {
  canViewVideo,
  decideVideoAccess,
  loadViewerContext,
  type AccessVideo,
  type ViewerContext
} from "../lib/videoAccess";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const videoRoutes = new Hono<AppEnv>();

videoRoutes.use("*", attachUser);

const idParam = z.string().min(1).max(64);

/**
 * Loads one video (any status) as an AccessVideo plus its raw source, in
 * mock or DB mode, for the access-controlled endpoints below.
 */
async function loadAccessVideo(id: string): Promise<{
  access: AccessVideo;
  playbackUrl: string | null | undefined;
  row?: VideoRow;
} | null> {
  if (!isBackendConfigured()) {
    const video = mockVideos.find((candidate) => candidate.id === id);
    if (!video) return null;
    return { access: video, playbackUrl: video.playbackUrl };
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("videos").select(VIDEO_SELECT).eq("id", id).maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) return null;
  const row = data as unknown as VideoRow;
  return { access: rowToAccessVideo(row), playbackUrl: row.playback_url, row };
}

/** Moderation rule: content from banned/suspended/deleted creators is
 * hidden everywhere for everyone but the owner (feeds enforce this via
 * applyFeedRules; detail/access endpoints via this check). */
function creatorSuspended(row: VideoRow | undefined, viewer: ViewerContext): boolean {
  const status = row?.creators?.profiles?.status;
  if (!status || !["banned", "suspended", "deleted"].includes(status)) return false;
  return !viewer.isAdmin && !viewer.ownCreatorIds.has(row!.creator_id);
}

/**
 * Asserts the caller may view/interact with a video before an engagement
 * action (like/save/share/comment). Unauthorized gated content behaves as if
 * it does not exist (404) so ids are not probeable.
 */
async function requireViewableVideo(id: string, viewer: ViewerContext): Promise<void> {
  const loaded = await loadAccessVideo(id);
  if (!loaded || !canViewVideo(viewer, loaded.access) || creatorSuspended(loaded.row, viewer)) {
    throw notFound("Video not found");
  }
}

/**
 * Server-side access check for locked content. The playback URL for gated
 * videos is ONLY ever returned here, after verifying a real entitlement or
 * membership through the central access rules. Client-side state is never
 * trusted.
 */
videoRoutes.get("/:id/access", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  const source = isBackendConfigured() ? "db" : "mock";

  const [viewer, loaded] = await Promise.all([loadViewerContext(profile.id), loadAccessVideo(id)]);
  if (!loaded || creatorSuspended(loaded.row, viewer)) throw notFound("Video not available");

  const decision = decideVideoAccess(viewer, loaded.access);
  if (!decision.allowed) {
    // Non-listable content 404s; entitlement failures 403 with the reason the
    // client needs to render the right CTA (follow/subscribe/unlock).
    if (decision.reason === "unavailable" || decision.reason === "private") {
      throw notFound("Video not available");
    }
    return c.json({ access: false, reason: decision.reason, source }, 403);
  }
  return c.json({
    access: true,
    reason: decision.reason,
    playbackUrl: preparePlaybackUrl(loaded.playbackUrl),
    source
  });
});

/**
 * Video metadata by id, per-viewer. Unauthorized gated/private content 404s
 * (it must not be probeable), and locked videos never expose playback here
 * (that requires /:id/access).
 */
videoRoutes.get("/:id", async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile");
  const viewer = await loadViewerContext(profile?.id);

  if (!isBackendConfigured()) {
    const video = mockVideos.find((candidate) => candidate.id === id);
    if (!video || !canViewVideo(viewer, video)) throw notFound("Video not found");
    return c.json({
      video: {
        ...video,
        isPremium: video.visibility !== "public",
        playbackUrl: video.visibility === "public" ? video.playbackUrl : undefined
      },
      source: "mock"
    });
  }

  const [hidden, loaded] = await Promise.all([blockedCreatorIds(profile?.id), loadAccessVideo(id)]);
  if (!loaded?.row) throw notFound("Video not found");
  const row = loaded.row;
  if (hidden.has(row.creator_id) || creatorSuspended(row, viewer)) throw notFound("Video not found");
  if (!canViewVideo(viewer, loaded.access)) throw notFound("Video not found");
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
  const viewer = await loadViewerContext(profile.id);
  await requireViewableVideo(id, viewer);
  if (!isBackendConfigured()) return c.json({ liked: true, source: "mock" });
  const liked = await toggleRow("likes", profile.id, id);
  return c.json({ liked, source: "db" });
});

videoRoutes.post("/:id/save", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`save:${profile.id}`, 120, 60_000);
  const viewer = await loadViewerContext(profile.id);
  await requireViewableVideo(id, viewer);
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

  const viewer = await loadViewerContext(profile?.id);
  await requireViewableVideo(id, viewer);

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

  // Comments are part of the video's content: same access rules apply.
  const viewer = await loadViewerContext(c.get("profile")?.id);
  await requireViewableVideo(id, viewer);

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

  const viewer = await loadViewerContext(profile.id);
  await requireViewableVideo(id, viewer);

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
