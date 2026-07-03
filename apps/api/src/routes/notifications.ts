import { Hono } from "hono";
import { z } from "zod";
import { mockNotificationPreferences, mockNotifications } from "@vuqiro/mock-data";
import { badRequest } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use("*", attachUser);

/** The caller's notification inbox. */
notificationRoutes.get("/notifications", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ notifications: mockNotifications, unread: mockNotifications.filter((n) => !n.isRead).length, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("notifications")
    .select("id, type, title, body, is_read, related_profile_id, related_video_id, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);

  const notifications = (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    relatedUserId: row.related_profile_id ?? undefined,
    relatedVideoId: row.related_video_id ?? undefined,
    createdAt: row.created_at
  }));
  return c.json({ notifications, unread: notifications.filter((n) => !n.isRead).length, source: "db" });
});

const readBody = z.object({
  notificationId: z.string().min(1).max(64).optional(),
  all: z.boolean().optional()
});

notificationRoutes.post("/notifications/read", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = readBody.parse(await c.req.json());
  if (!body.notificationId && !body.all) throw badRequest("Provide notificationId or all=true");

  if (!isBackendConfigured()) {
    return c.json({ ok: true, source: "mock" });
  }

  const db = getServiceDb()!;
  let query = db.from("notifications").update({ is_read: true }).eq("profile_id", profile.id);
  if (body.notificationId) {
    query = query.eq("id", body.notificationId);
  }
  const { error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ ok: true, source: "db" });
});

notificationRoutes.get("/notifications/preferences", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ preferences: mockNotificationPreferences, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data } = await db
    .from("notification_preferences")
    .select("followers, comments, creator_updates, purchases, payouts, moderation, system, push_enabled")
    .eq("profile_id", profile.id)
    .maybeSingle();

  return c.json({
    preferences: data ?? {
      followers: true,
      comments: true,
      creator_updates: true,
      purchases: true,
      payouts: true,
      moderation: true,
      system: true,
      push_enabled: false
    },
    source: "db"
  });
});

const preferencesBody = z.object({
  followers: z.boolean().optional(),
  comments: z.boolean().optional(),
  creatorUpdates: z.boolean().optional(),
  purchases: z.boolean().optional(),
  payouts: z.boolean().optional(),
  moderation: z.boolean().optional(),
  system: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  pushToken: z.string().max(256).optional()
});

notificationRoutes.post("/notifications/preferences", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = preferencesBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ ok: true, source: "mock" });
  }

  const db = getServiceDb()!;
  const update: Record<string, unknown> = { profile_id: profile.id };
  if (body.followers !== undefined) update.followers = body.followers;
  if (body.comments !== undefined) update.comments = body.comments;
  if (body.creatorUpdates !== undefined) update.creator_updates = body.creatorUpdates;
  if (body.purchases !== undefined) update.purchases = body.purchases;
  if (body.payouts !== undefined) update.payouts = body.payouts;
  if (body.moderation !== undefined) update.moderation = body.moderation;
  if (body.system !== undefined) update.system = body.system;
  if (body.pushEnabled !== undefined) update.push_enabled = body.pushEnabled;
  if (body.pushToken !== undefined) update.push_token = body.pushToken;

  const { error } = await db.from("notification_preferences").upsert(update, { onConflict: "profile_id" });
  if (error) throw badRequest(error.message);
  return c.json({ ok: true, source: "db" });
});

const pushTokenBody = z.object({
  token: z.string().min(8).max(256),
  platform: z.enum(["ios", "android", "web"]),
  installId: z.string().max(120).optional(),
  deviceModel: z.string().max(120).optional(),
  osVersion: z.string().max(60).optional(),
  appVersion: z.string().max(40).optional()
});

/** Register (or refresh) a device push token. */
notificationRoutes.post("/notifications/push-token", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = pushTokenBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ registered: true, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  let deviceId: string | null = null;
  if (body.installId) {
    const { data: device } = await db
      .from("user_devices")
      .upsert(
        {
          profile_id: profile.id,
          install_id: body.installId,
          platform: body.platform,
          device_model: body.deviceModel ?? "",
          os_version: body.osVersion ?? "",
          app_version: body.appVersion ?? "",
          last_seen_at: new Date().toISOString()
        },
        { onConflict: "profile_id,install_id" }
      )
      .select("id")
      .single();
    deviceId = device?.id ?? null;
  }

  const { error } = await db.from("push_tokens").upsert(
    {
      profile_id: profile.id,
      device_id: deviceId,
      token: body.token,
      platform: body.platform,
      is_active: true
    },
    { onConflict: "token" }
  );
  if (error) throw badRequest(error.message);

  await db.from("notification_preferences").upsert(
    { profile_id: profile.id, push_enabled: true, push_token: body.token },
    { onConflict: "profile_id" }
  );
  return c.json({ registered: true, source: "db" }, 201);
});

/** Deactivate a push token (logout / permission revoked). */
notificationRoutes.delete("/notifications/push-token", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = z.object({ token: z.string().min(8).max(256) }).parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ removed: true, source: "mock" });
  }
  const db = getServiceDb()!;
  const { error } = await db
    .from("push_tokens")
    .update({ is_active: false })
    .eq("profile_id", profile.id)
    .eq("token", body.token);
  if (error) throw badRequest(error.message);
  return c.json({ removed: true, source: "db" });
});
