import { Hono } from "hono";
import { z } from "zod";
import { mockComments } from "@vuqiro/mock-data";
import { badRequest } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const videoRoutes = new Hono<AppEnv>();

videoRoutes.use("*", attachUser);

const idParam = z.string().min(1).max(64);

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
