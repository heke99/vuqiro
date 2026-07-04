import { Hono } from "hono";
import { z } from "zod";
import { badRequest } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser } from "../middleware/auth";

/**
 * Feed session + impression tracking. These signals feed the
 * recommendation engine (watch time, completion, quick skips, engagement).
 */
export const feedSessionRoutes = new Hono<AppEnv>();

feedSessionRoutes.use("*", attachUser);

const startBody = z.object({
  feedType: z.enum(["for_you", "following", "trending", "hashtag", "sound", "premium"]).default("for_you"),
  anonSessionId: z.string().max(120).optional(),
  country: z.string().length(2).optional(),
  language: z.string().min(2).max(8).optional(),
  appVersion: z.string().max(40).optional()
});

feedSessionRoutes.post("/feed/session/start", async (c) => {
  const profile = c.get("profile");
  const body = startBody.parse(await c.req.json().catch(() => ({})));
  enforceRateLimit(`feed-session:${profile?.id ?? body.anonSessionId ?? "anon"}`, 60, 60_000);

  if (!isBackendConfigured()) {
    return c.json({ sessionId: `mock_fs_${Date.now()}`, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("feed_sessions")
    .insert({
      profile_id: profile?.id ?? null,
      anon_session_id: body.anonSessionId,
      feed_type: body.feedType,
      country: body.country,
      language: body.language,
      app_version: body.appVersion
    })
    .select("id")
    .single();
  if (error) throw badRequest(error.message);
  return c.json({ sessionId: data.id, source: "db" }, 201);
});

const endBody = z.object({
  sessionId: z.string().min(1),
  itemCount: z.number().int().nonnegative().default(0)
});

feedSessionRoutes.post("/feed/session/end", async (c) => {
  const body = endBody.parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ ended: true, source: "mock" });
  }
  const db = getServiceDb()!;
  const { error } = await db
    .from("feed_sessions")
    .update({ ended_at: new Date().toISOString(), item_count: body.itemCount })
    .eq("id", body.sessionId);
  if (error) throw badRequest(error.message);
  return c.json({ ended: true, source: "db" });
});

const impressionSchema = z.object({
  sessionId: z.string().optional(),
  videoId: z.string().optional(),
  adCreativeId: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  watchedMs: z.number().int().nonnegative().optional(),
  completed: z.boolean().default(false),
  liked: z.boolean().default(false),
  commented: z.boolean().default(false),
  shared: z.boolean().default(false),
  saved: z.boolean().default(false),
  followedCreator: z.boolean().default(false),
  skippedQuickly: z.boolean().default(false),
  source: z.string().max(40).optional()
});

// The batch shape must be tried first: every field on a single impression is
// optional, so a batch body would otherwise match the single-impression schema.
const impressionBody = z.union([z.object({ impressions: z.array(impressionSchema).max(50) }), impressionSchema]);

/** Accepts a single impression or a batch (mobile flushes in batches). */
feedSessionRoutes.post("/feed/impression", async (c) => {
  const profile = c.get("profile");
  const parsed = impressionBody.parse(await c.req.json());
  const impressions = "impressions" in parsed ? parsed.impressions : [parsed];
  if (impressions.length === 0) return c.json({ recorded: 0, source: isBackendConfigured() ? "db" : "mock" });
  enforceRateLimit(`feed-impressions:${profile?.id ?? "anon"}`, 120, 60_000);

  const valid = impressions.filter((impression) => impression.videoId || impression.adCreativeId);
  if (valid.length === 0) throw badRequest("Each impression needs a videoId or adCreativeId");

  if (!isBackendConfigured()) {
    return c.json({ recorded: valid.length, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { error } = await db.from("feed_impressions").insert(
    valid.map((impression) => ({
      feed_session_id: impression.sessionId ?? null,
      profile_id: profile?.id ?? null,
      video_id: impression.videoId ?? null,
      ad_creative_id: impression.adCreativeId ?? null,
      position: impression.position,
      watched_ms: impression.watchedMs,
      completed: impression.completed,
      liked: impression.liked,
      commented: impression.commented,
      shared: impression.shared,
      saved: impression.saved,
      followed_creator: impression.followedCreator,
      skipped_quickly: impression.skippedQuickly,
      source: impression.source
    }))
  );
  if (error) throw badRequest(error.message);
  return c.json({ recorded: valid.length, source: "db" }, 201);
});
