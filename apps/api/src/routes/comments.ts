import { Hono } from "hono";
import { z } from "zod";
import { badRequest, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const commentRoutes = new Hono<AppEnv>();

commentRoutes.use("*", attachUser);

const replyBody = z.object({
  text: z.string().trim().min(1).max(1000)
});

commentRoutes.post("/:id/replies", requireUser, async (c) => {
  const parentId = z.string().min(1).max(64).parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`comment:${profile.id}`, 20, 60_000);
  const body = replyBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json(
      { comment: { id: `mock_${Date.now()}`, parentCommentId: parentId, text: body.text }, source: "mock" },
      201
    );
  }

  const db = getServiceDb()!;
  const { data: parent } = await db
    .from("comments")
    .select("id, video_id")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) throw notFound("Comment not found");

  const { data, error } = await db
    .from("comments")
    .insert({ video_id: parent.video_id, author_id: profile.id, parent_comment_id: parentId, text: body.text })
    .select("id, video_id, author_id, parent_comment_id, text, created_at")
    .single();
  if (error) throw badRequest(error.message);

  // Keep the parent's reply counter in sync.
  const { count } = await db
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("parent_comment_id", parentId);
  await db.from("comments").update({ reply_count: count ?? 0 }).eq("id", parentId);

  return c.json({ comment: data, source: "db" }, 201);
});
