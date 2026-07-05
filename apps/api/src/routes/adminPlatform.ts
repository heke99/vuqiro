import { Hono } from "hono";
import { z } from "zod";
import { mockComments, mockCreators, mockUsers, mockVideos } from "@vuqiro/mock-data";
import { writeAuditLog } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { explainVideoRanking } from "../lib/feedRanking";
import { DEFAULT_FEED_WEIGHTS } from "../lib/platformSettings";
import { scoreVideo, type RankingInput } from "../lib/ranking";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

/**
 * Platform administration: users, creators, videos, comments — lists,
 * details and enforcement actions. Every enforcement action is audit-logged.
 */
export const adminPlatformRoutes = new Hono<AppEnv>();

adminPlatformRoutes.use("*", requireAdmin());

const enforcementRoles = requireAdmin("platform_superadmin", "admin", "moderator");

const pageQuery = (c: { req: { query: (key: string) => string | undefined } }) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "50"), 1), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);
  return { limit, offset };
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminPlatformRoutes.get("/users", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ users: mockUsers, total: mockUsers.length, source: "mock" });
  }
  const db = getServiceDb()!;
  const { limit, offset } = pageQuery(c);
  let query = db
    .from("profiles")
    .select("id, handle, display_name, avatar_url, role, status, is_creator, is_verified, country, language, follower_count, video_count, created_at", {
      count: "exact"
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const search = c.req.query("q");
  if (search) query = query.or(`handle.ilike.%${search}%,display_name.ilike.%${search}%`);
  const { data, error, count } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ users: data ?? [], total: count ?? 0, source: "db" });
});

adminPlatformRoutes.get("/users/:id", async (c) => {
  const id = z.string().min(1).parse(c.req.param("id"));
  if (!isBackendConfigured()) {
    const user = mockUsers.find((candidate) => candidate.id === id) ?? mockUsers[0];
    return c.json({ user, wallet: { coinBalance: 1250 }, reports: [], deletionRequests: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: user } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!user) throw notFound("User not found");
  const [wallet, reports, deletionRequests, settings, safety] = await Promise.all([
    db.from("wallets").select("coin_balance, locked_balance").eq("profile_id", id).maybeSingle(),
    db.from("reports").select("*").eq("reporter_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("account_deletion_requests").select("*").eq("profile_id", id).order("requested_at", { ascending: false }),
    db.from("profile_settings").select("*").eq("profile_id", id).maybeSingle(),
    db.from("user_safety_settings").select("*").eq("profile_id", id).maybeSingle()
  ]);
  return c.json({
    user,
    wallet: wallet.data,
    reports: reports.data ?? [],
    deletionRequests: deletionRequests.data ?? [],
    settings: settings.data,
    safetySettings: safety.data,
    source: "db"
  });
});

const statusActionBody = z.object({ note: z.string().trim().max(1000).optional() });

const userStatusActions: Record<string, { to: string; action: string }> = {
  suspend: { to: "suspended", action: "user_suspend" },
  unsuspend: { to: "active", action: "user_unsuspend" },
  ban: { to: "banned", action: "user_ban" },
  restore: { to: "active", action: "user_restore" }
};

adminPlatformRoutes.post("/users/:id/:action", enforcementRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const actionName = z.string().parse(c.req.param("action"));
  const action = userStatusActions[actionName];
  if (!action) throw notFound("Unknown user action");
  const body = statusActionBody.parse(await c.req.json().catch(() => ({})));

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: action.action,
      targetType: "profile",
      targetId: id,
      summary: `${actionName} user (mock mode)`
    });
    return c.json({ userId: id, status: action.to, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: user } = await db.from("profiles").select("id, handle, status").eq("id", id).maybeSingle();
  if (!user) throw notFound("User not found");
  const { error } = await db.from("profiles").update({ status: action.to }).eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: action.action,
    targetType: "profile",
    targetId: id,
    summary: `@${user.handle}: ${user.status} → ${action.to}${body.note ? ` — ${body.note}` : ""}`
  });
  return c.json({ userId: id, status: action.to, source: "db" });
});

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------

adminPlatformRoutes.get("/creators", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ creators: mockCreators, total: mockCreators.length, source: "mock" });
  }
  const db = getServiceDb()!;
  const { limit, offset } = pageQuery(c);
  let query = db
    .from("creators")
    .select("*, profiles (handle, display_name, status, follower_count, video_count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const verification = c.req.query("verification");
  if (verification) query = query.eq("verification_status", verification);
  const { data, error, count } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ creators: data ?? [], total: count ?? 0, source: "db" });
});

adminPlatformRoutes.get("/creators/:id", async (c) => {
  const id = z.string().min(1).parse(c.req.param("id"));
  if (!isBackendConfigured()) {
    const creator = mockCreators.find((candidate) => candidate.id === id) ?? mockCreators[0];
    return c.json({ creator, videos: [], ledger: [], payoutAccount: null, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: creator } = await db
    .from("creators")
    .select("*, profiles (handle, display_name, status, follower_count, video_count), creator_profiles (*)")
    .eq("id", id)
    .maybeSingle();
  if (!creator) throw notFound("Creator not found");
  const [videos, ledger, payoutAccount, memberships] = await Promise.all([
    db.from("videos").select("id, caption, status, moderation_status, like_count, watch_count, created_at").eq("creator_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("creator_revenue_ledger").select("*").eq("creator_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("creator_payout_accounts").select("*").eq("creator_id", id).maybeSingle(),
    db.from("creator_memberships").select("id", { count: "exact", head: true }).eq("creator_id", id).eq("status", "active")
  ]);
  return c.json({
    creator,
    videos: videos.data ?? [],
    ledger: ledger.data ?? [],
    payoutAccount: payoutAccount.data,
    activeMemberships: memberships.count ?? 0,
    source: "db"
  });
});

const creatorActions: Record<string, { patch: Record<string, unknown>; action: string }> = {
  verify: { patch: { verification_status: "verified" }, action: "creator_verify" },
  reject: { patch: { verification_status: "rejected" }, action: "creator_reject" },
  "enable-monetization": { patch: { monetization_enabled: true }, action: "creator_monetization_enable" },
  "disable-monetization": { patch: { monetization_enabled: false }, action: "creator_monetization_disable" }
};

adminPlatformRoutes.post("/creators/:id/:action", enforcementRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const actionName = z.string().parse(c.req.param("action"));
  const action = creatorActions[actionName];
  if (!action) throw notFound("Unknown creator action");

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: action.action,
      targetType: "creator",
      targetId: id,
      summary: `${actionName} (mock mode)`
    });
    return c.json({ creatorId: id, ...action.patch, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: creator } = await db.from("creators").select("id").eq("id", id).maybeSingle();
  if (!creator) throw notFound("Creator not found");
  const { error } = await db.from("creators").update(action.patch).eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: action.action,
    targetType: "creator",
    targetId: id,
    summary: `Creator ${actionName}`
  });
  return c.json({ creatorId: id, ...action.patch, source: "db" });
});

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

adminPlatformRoutes.get("/videos", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ videos: mockVideos, total: mockVideos.length, source: "mock" });
  }
  const db = getServiceDb()!;
  const { limit, offset } = pageQuery(c);
  let query = db
    .from("videos")
    .select("id, creator_id, caption, status, moderation_status, visibility, ad_eligible, is_featured, like_count, comment_count, watch_count, report_count, created_at, creators (profiles (handle))", {
      count: "exact"
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const moderation = c.req.query("moderation");
  if (moderation) query = query.eq("moderation_status", moderation);
  const { data, error, count } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ videos: data ?? [], total: count ?? 0, source: "db" });
});

adminPlatformRoutes.get("/videos/:id", async (c) => {
  const id = z.string().min(1).parse(c.req.param("id"));
  if (!isBackendConfigured()) {
    const video = mockVideos.find((candidate) => candidate.id === id) ?? mockVideos[0];
    return c.json({ video, asset: null, reports: [], processingJobs: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: video } = await db
    .from("videos")
    .select("*, creators (id, profiles (handle, display_name))")
    .eq("id", id)
    .maybeSingle();
  if (!video) throw notFound("Video not found");
  const [asset, reports, jobs] = await Promise.all([
    db.from("video_assets").select("*").eq("video_id", id).maybeSingle(),
    db.from("reports").select("*").eq("target_type", "video").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("video_processing_jobs").select("*").eq("video_id", id).order("created_at", { ascending: false }).limit(20)
  ]);
  return c.json({ video, asset: asset.data, reports: reports.data ?? [], processingJobs: jobs.data ?? [], source: "db" });
});

type VideoPatch = Record<string, unknown> | ((admin: { id: string }) => Record<string, unknown>);

const videoActions: Record<string, { patch: VideoPatch; action: string }> = {
  hide: { patch: { moderation_status: "limited" }, action: "video_hide" },
  remove: { patch: { moderation_status: "removed", status: "removed" }, action: "video_remove" },
  restore: { patch: { moderation_status: "visible", status: "ready" }, action: "video_restore" },
  "age-restrict": { patch: { moderation_status: "age_restricted" }, action: "video_age_restrict" },
  "ad-eligible": { patch: { ad_eligible: true }, action: "video_ad_eligible" },
  "ad-ineligible": { patch: { ad_eligible: false }, action: "video_ad_ineligible" },
  feature: {
    patch: (admin) => ({ is_featured: true, featured_at: new Date().toISOString(), featured_by: admin.id }),
    action: "video_feature"
  },
  unfeature: {
    patch: { is_featured: false, featured_at: null, featured_by: null },
    action: "video_unfeature"
  }
};

adminPlatformRoutes.post("/videos/:id/:action", enforcementRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const actionName = z.string().parse(c.req.param("action"));
  const action = videoActions[actionName];
  if (!action) throw notFound("Unknown video action");
  const patch = typeof action.patch === "function" ? action.patch(admin) : action.patch;

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: action.action,
      targetType: "video",
      targetId: id,
      summary: `${actionName} (mock mode)`
    });
    return c.json({ videoId: id, ...patch, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: video } = await db.from("videos").select("id, caption").eq("id", id).maybeSingle();
  if (!video) throw notFound("Video not found");
  const { error } = await db.from("videos").update(patch).eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: action.action,
    targetType: "video",
    targetId: id,
    summary: `Video ${actionName}: "${(video.caption as string).slice(0, 60)}"`
  });
  return c.json({ videoId: id, ...patch, source: "db" });
});

// ---------------------------------------------------------------------------
// Ranking inspector: full factor breakdown for one video (why it ranks)
// ---------------------------------------------------------------------------

adminPlatformRoutes.get("/videos/:id/ranking", async (c) => {
  const id = z.string().min(1).parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    const video = mockVideos.find((candidate) => candidate.id === id) ?? mockVideos[0];
    const input: RankingInput = {
      videoId: video.id,
      creatorId: video.creatorId,
      createdAt: video.createdAt ?? new Date().toISOString(),
      watchCount: video.watchCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      saveCount: 0,
      shareCount: video.shareCount,
      safetyScore: 100,
      moderationStatus: video.moderationStatus ?? "visible",
      reportCount: 0,
      creatorFollowerCount: 0,
      creatorVerified: false,
      creatorVideoCount: 1
    };
    return c.json({ videoId: video.id, result: scoreVideo(input), input, weights: DEFAULT_FEED_WEIGHTS, source: "mock" });
  }

  const explanation = await explainVideoRanking(id);
  if (!explanation) throw notFound("Video not found");
  return c.json({ ...explanation, source: "db" });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

adminPlatformRoutes.get("/comments", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ comments: mockComments, total: mockComments.length, source: "mock" });
  }
  const db = getServiceDb()!;
  const { limit, offset } = pageQuery(c);
  let query = db
    .from("comments")
    .select("*, profiles!comments_author_id_fkey (handle)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const moderation = c.req.query("moderation");
  if (moderation) query = query.eq("moderation_status", moderation);
  const flagged = c.req.query("flagged");
  if (flagged === "1") query = query.gt("report_count", 0);
  const { data, error, count } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ comments: data ?? [], total: count ?? 0, source: "db" });
});

const commentActions: Record<string, { patch: Record<string, unknown>; action: string }> = {
  hide: { patch: { moderation_status: "limited" }, action: "comment_hide" },
  remove: { patch: { moderation_status: "removed" }, action: "comment_remove" },
  restore: { patch: { moderation_status: "visible" }, action: "comment_restore" }
};

adminPlatformRoutes.post("/comments/:id/:action", enforcementRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const actionName = z.string().parse(c.req.param("action"));
  const action = commentActions[actionName];
  if (!action) throw notFound("Unknown comment action");

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: action.action,
      targetType: "comment",
      targetId: id,
      summary: `${actionName} (mock mode)`
    });
    return c.json({ commentId: id, ...action.patch, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: comment } = await db.from("comments").select("id").eq("id", id).maybeSingle();
  if (!comment) throw notFound("Comment not found");
  const { error } = await db.from("comments").update(action.patch).eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: action.action,
    targetType: "comment",
    targetId: id,
    summary: `Comment ${actionName}`
  });
  return c.json({ commentId: id, ...action.patch, source: "db" });
});
