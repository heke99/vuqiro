import { Hono } from "hono";
import { z } from "zod";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser } from "../middleware/auth";

export const eventRoutes = new Hono<AppEnv>();

eventRoutes.use("*", attachUser);

const eventNames = [
  "app_open",
  "signup_started",
  "signup_completed",
  "feed_view",
  "video_impression",
  "video_play",
  "video_pause",
  "video_progress",
  "video_complete",
  "video_skip",
  "video_rewatch",
  "video_like",
  "video_save",
  "video_share",
  "video_comment_open",
  "video_share_open",
  "video_report",
  "comment_open",
  "comment_submit",
  "creator_profile_open",
  "creator_follow",
  "creator_subscribe_open",
  "creator_subscribe_success",
  "coin_pack_open",
  "coin_support_open",
  "coin_purchase_success",
  "coin_tip_sent",
  "video_unlock_success",
  "report_submit",
  "block_user",
  "upload_started",
  "upload_submitted",
  "admin_action"
] as const;

const eventsBody = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(eventNames),
        videoId: z.string().max(64).optional(),
        creatorId: z.string().max(64).optional(),
        value: z.number().finite().optional(),
        at: z.string().datetime().optional()
      })
    )
    .min(1)
    .max(100)
});

/**
 * Batched analytics ingestion. Anonymous events are accepted (profile null);
 * signed-in events attach the caller's profile. Feeds the ranking engine.
 */
eventRoutes.post("/events", async (c) => {
  const profile = c.get("profile");
  enforceRateLimit(`events:${profile?.id ?? "anon"}`, 60, 60_000);
  const body = eventsBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ accepted: body.events.length, source: "mock" }, 202);
  }

  const db = getServiceDb()!;
  const rows = body.events.map((event) => ({
    video_id: event.videoId ?? null,
    profile_id: profile?.id ?? null,
    name: event.name,
    value: event.value ?? null,
    metadata: event.creatorId ? { creatorId: event.creatorId } : {},
    created_at: event.at ?? new Date().toISOString()
  }));

  const { error } = await db.from("video_events").insert(rows);
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ accepted: rows.length, source: "db" }, 202);
});
