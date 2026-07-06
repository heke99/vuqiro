import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { mockAuditLogs, mockFeatureFlags, mockNotifications } from "@vuqiro/mock-data";
import { computeDailyRollups } from "../lib/analyticsRollup";
import { writeAuditLog } from "../lib/audit";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { getHealthReport } from "../lib/health";
import { PLATFORM_SETTING_DEFAULTS, resetPlatformSettingsCache } from "../lib/platformSettings";
import { processAccountDeletions, processDataExports } from "../lib/privacyWorkers";
import { processNotificationJobs } from "../lib/pushDelivery";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import { computeTrendSnapshots } from "../lib/trending";
import type { AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

/**
 * Platform operations: admin users & invitations, feature flags, platform
 * settings, integration health, support cases, audit log queries, broadcasts.
 */
export const adminOpsRoutes = new Hono<AppEnv>();

adminOpsRoutes.use("*", requireAdmin());

const superadminOnly = requireAdmin("platform_superadmin");

// ---------------------------------------------------------------------------
// Admin users & invitations (superadmin only)
// ---------------------------------------------------------------------------

adminOpsRoutes.get("/admin-users", requireAdmin("platform_superadmin", "admin"), async (c) => {
  if (!isBackendConfigured()) {
    return c.json({
      admins: [
        { id: "admin_001", email: "superadmin@vuqiro.app", display_name: "Vuqiro Superadmin", role: "platform_superadmin", is_active: true }
      ],
      source: "mock"
    });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("admin_users")
    .select("id, email, display_name, role, is_active, created_at")
    .order("created_at");
  if (error) throw badRequest(error.message);
  return c.json({ admins: data ?? [], source: "db" });
});

const inviteBody = z.object({
  email: z.string().email(),
  role: z.enum(["platform_superadmin", "admin", "moderator", "finance", "support"])
});

adminOpsRoutes.post("/admin-users/invite", superadminOnly, async (c) => {
  const admin = c.get("admin")!;
  const body = inviteBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "admin_invite",
      targetType: "admin_invitation",
      targetId: body.email,
      summary: `Invited ${body.email} as ${body.role} (mock mode)`
    });
    return c.json({ invitation: { id: `mock_inv_${Date.now()}`, ...body, status: "pending" }, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("admin_invitations")
    .insert({ email: body.email, role: body.role, token: randomUUID(), invited_by: admin.id })
    .select("id, email, role, status, expires_at, created_at")
    .single();
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "admin_invite",
    targetType: "admin_invitation",
    targetId: data.id,
    summary: `Invited ${body.email} as ${body.role}`
  });
  return c.json({ invitation: data, source: "db" }, 201);
});

adminOpsRoutes.get("/admin-users/invitations", requireAdmin("platform_superadmin", "admin"), async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ invitations: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("admin_invitations")
    .select("id, email, role, status, invited_by, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);
  return c.json({ invitations: data ?? [], source: "db" });
});

adminOpsRoutes.post("/admin-users/invitations/:id/revoke", superadminOnly, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  if (!isBackendConfigured()) {
    return c.json({ invitationId: id, status: "revoked", source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("admin_invitations")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, email")
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Pending invitation not found");
  await writeAuditLog(admin, {
    action: "admin_invite_revoke",
    targetType: "admin_invitation",
    targetId: id,
    summary: `Revoked invitation for ${data.email}`
  });
  return c.json({ invitationId: id, status: "revoked", source: "db" });
});

const roleBody = z.object({ role: z.enum(["platform_superadmin", "admin", "moderator", "finance", "support"]) });

adminOpsRoutes.post("/admin-users/:id/role", superadminOnly, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = roleBody.parse(await c.req.json());
  if (id === admin.id) throw forbidden("Cannot change your own role");

  if (!isBackendConfigured()) {
    return c.json({ adminId: id, role: body.role, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("admin_users")
    .update({ role: body.role })
    .eq("id", id)
    .select("id, email")
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Admin not found");
  await writeAuditLog(admin, {
    action: "admin_role_change",
    targetType: "admin_user",
    targetId: id,
    summary: `Changed ${data.email} role to ${body.role}`
  });
  return c.json({ adminId: id, role: body.role, source: "db" });
});

adminOpsRoutes.post("/admin-users/:id/disable", superadminOnly, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  if (id === admin.id) throw forbidden("Cannot disable your own account");

  if (!isBackendConfigured()) {
    return c.json({ adminId: id, isActive: false, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("admin_users")
    .update({ is_active: false })
    .eq("id", id)
    .select("id, email")
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Admin not found");
  await writeAuditLog(admin, {
    action: "admin_disable",
    targetType: "admin_user",
    targetId: id,
    summary: `Disabled admin ${data.email}`
  });
  return c.json({ adminId: id, isActive: false, source: "db" });
});

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

adminOpsRoutes.get("/feature-flags", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ flags: mockFeatureFlags, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("feature_flags").select("*").order("key");
  if (error) throw badRequest(error.message);
  return c.json({ flags: data ?? [], source: "db" });
});

const flagBody = z.object({ enabled: z.boolean() });

adminOpsRoutes.patch("/feature-flags/:key", requireAdmin("platform_superadmin", "admin"), async (c) => {
  const admin = c.get("admin")!;
  const key = z.string().min(1).parse(c.req.param("key"));
  const body = flagBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "feature_flag_update",
      targetType: "feature_flag",
      targetId: key,
      summary: `${key} → ${body.enabled ? "enabled" : "disabled"} (mock mode)`
    });
    return c.json({ key, enabled: body.enabled, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("feature_flags")
    .update({ enabled: body.enabled, updated_by: admin.id })
    .eq("key", key)
    .select("key")
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Feature flag not found");

  await writeAuditLog(admin, {
    action: "feature_flag_update",
    targetType: "feature_flag",
    targetId: key,
    summary: `${key} → ${body.enabled ? "enabled" : "disabled"}`
  });
  return c.json({ key, enabled: body.enabled, source: "db" });
});

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

adminOpsRoutes.get("/platform-settings", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({
      settings: Object.entries(PLATFORM_SETTING_DEFAULTS).map(([key, value]) => ({ key, value, description: "default" })),
      source: "mock"
    });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("platform_settings").select("*").order("key");
  if (error) throw badRequest(error.message);
  // Merge with defaults so the console always shows every known setting.
  const byKey = new Map((data ?? []).map((row) => [row.key, row]));
  const settings = Object.entries(PLATFORM_SETTING_DEFAULTS).map(([key, defaults]) => {
    const row = byKey.get(key);
    return row
      ? { ...row, value: { ...defaults, ...(row.value as Record<string, unknown>) } }
      : { key, value: defaults, description: "default (not yet saved)" };
  });
  for (const row of data ?? []) {
    if (!(row.key in PLATFORM_SETTING_DEFAULTS)) settings.push(row);
  }
  return c.json({ settings, source: "db" });
});

const settingBody = z.object({
  value: z.record(z.unknown()),
  description: z.string().trim().max(500).optional()
});

adminOpsRoutes.put("/platform-settings/:key", requireAdmin("platform_superadmin", "admin"), async (c) => {
  const admin = c.get("admin")!;
  const key = z.string().min(1).max(100).parse(c.req.param("key"));
  const body = settingBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "platform_setting_update",
      targetType: "platform_setting",
      targetId: key,
      summary: `Updated setting ${key} (mock mode)`
    });
    return c.json({ key, value: body.value, source: "mock" });
  }

  const db = getServiceDb()!;
  const { error } = await db
    .from("platform_settings")
    .upsert({ key, value: body.value, description: body.description ?? "", updated_by: admin.id }, { onConflict: "key" });
  if (error) throw badRequest(error.message);
  resetPlatformSettingsCache();

  await writeAuditLog(admin, {
    action: "platform_setting_update",
    targetType: "platform_setting",
    targetId: key,
    summary: `Updated setting ${key}`,
    metadata: { value: body.value }
  });
  return c.json({ key, value: body.value, source: "db" });
});

// ---------------------------------------------------------------------------
// Integration health
// ---------------------------------------------------------------------------

adminOpsRoutes.get("/integration-health", async (c) => {
  const report = await getHealthReport({ deep: c.req.query("deep") === "1" });
  const checks = [report.database, report.video, report.payments, report.payouts, report.push, report.email];

  // Persist a snapshot so history is visible even after incidents resolve.
  if (isBackendConfigured()) {
    const db = getServiceDb()!;
    await db.from("integration_health_checks").insert(
      checks.map((check) => ({
        provider: check.provider === "database" ? "supabase" : check.provider,
        status: check.status,
        message: check.message ?? ""
      }))
    );
  }
  return c.json({ report, checks, source: isBackendConfigured() ? "db" : "mock" });
});

adminOpsRoutes.get("/integration-health/history", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ history: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("integration_health_checks")
    .select("*")
    .order("checked_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);
  return c.json({ history: data ?? [], source: "db" });
});

// ---------------------------------------------------------------------------
// Support cases
// ---------------------------------------------------------------------------

adminOpsRoutes.get("/support-cases", requireAdmin("platform_superadmin", "admin", "support"), async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ cases: [], source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db
    .from("support_cases")
    .select("*, profiles (handle)")
    .order("created_at", { ascending: false })
    .limit(100);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ cases: data ?? [], source: "db" });
});

const supportUpdateBody = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assign: z.boolean().optional()
});

adminOpsRoutes.post("/support-cases/:id/update", requireAdmin("platform_superadmin", "admin", "support"), async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = supportUpdateBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ caseId: id, ...body, source: "mock" });
  }
  const db = getServiceDb()!;
  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.priority) patch.priority = body.priority;
  if (body.assign) patch.assigned_to = admin.id;
  const { data, error } = await db.from("support_cases").update(patch).eq("id", id).select("id").maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Support case not found");

  await writeAuditLog(admin, {
    action: "support_case_update",
    targetType: "support_case",
    targetId: id,
    summary: `Support case updated (${Object.keys(patch).join(", ")})`
  });
  return c.json({ caseId: id, ...body, source: "db" });
});

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

adminOpsRoutes.get("/audit-logs", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ logs: mockAuditLogs, source: "mock" });
  }
  const db = getServiceDb()!;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "100"), 1), 500);
  let query = db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  const action = c.req.query("action");
  if (action) query = query.eq("action", action);
  const targetType = c.req.query("targetType");
  if (targetType) query = query.eq("target_type", targetType);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ logs: data ?? [], source: "db" });
});

// ---------------------------------------------------------------------------
// Broadcast notifications
// ---------------------------------------------------------------------------

const broadcastBody = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  audience: z.enum(["all", "creators", "users"]).default("all")
});

adminOpsRoutes.post("/notifications/broadcast", requireAdmin("platform_superadmin", "admin"), async (c) => {
  const admin = c.get("admin")!;
  const body = broadcastBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "notification_broadcast",
      targetType: "notification",
      targetId: body.audience,
      summary: `Broadcast "${body.title}" to ${body.audience} (mock mode)`
    });
    return c.json({ queued: mockNotifications.length, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  let profileQuery = db.from("profiles").select("id").eq("status", "active");
  if (body.audience === "creators") profileQuery = profileQuery.eq("is_creator", true);
  if (body.audience === "users") profileQuery = profileQuery.eq("is_creator", false);
  const { data: profiles, error } = await profileQuery.limit(10000);
  if (error) throw badRequest(error.message);

  const recipients = profiles ?? [];
  if (recipients.length > 0) {
    // In-app notifications now; push fan-out via notification_jobs.
    const { error: insertError } = await db.from("notifications").insert(
      recipients.map((profile) => ({
        profile_id: profile.id,
        type: "system_notice",
        title: body.title,
        body: body.body
      }))
    );
    if (insertError) throw badRequest(insertError.message);
    await db.from("notification_jobs").insert(
      recipients.map((profile) => ({
        profile_id: profile.id,
        channel: "push",
        payload: { title: body.title, body: body.body, type: "system_notice" }
      }))
    );
  }

  await writeAuditLog(admin, {
    action: "notification_broadcast",
    targetType: "notification",
    targetId: body.audience,
    summary: `Broadcast "${body.title}" to ${recipients.length} ${body.audience}`
  });
  return c.json({ queued: recipients.length, source: "db" }, 201);
});

/** Run the push notification job queue (also invocable by an external cron). */
adminOpsRoutes.post("/notifications/process-jobs", requireAdmin("platform_superadmin", "admin"), async (c) => {
  const result = await processNotificationJobs();
  return c.json({ ...result, source: isBackendConfigured() ? "db" : "mock" });
});

// ---------------------------------------------------------------------------
// Trending snapshots (also invocable by an external cron)
// ---------------------------------------------------------------------------

/** Recent persisted rate-limit violations (ops visibility). */
adminOpsRoutes.get("/rate-limit-events", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ events: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("rate_limit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);
  return c.json({ events: data ?? [], source: "db" });
});

const rollupBody = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** Runs the daily analytics rollup (defaults to yesterday UTC). */
adminOpsRoutes.post("/ops/analytics/run", requireAdmin("platform_superadmin", "admin"), async (c) => {
  const admin = c.get("admin")!;
  const body = rollupBody.parse(await c.req.json().catch(() => ({})));

  if (!isBackendConfigured()) {
    return c.json({ date: body.date ?? "yesterday", videos: 0, creators: 0, source: "mock" });
  }
  const result = await computeDailyRollups(body.date);
  await writeAuditLog(admin, {
    action: "analytics_rollup_run",
    targetType: "platform_setting",
    targetId: `analytics_${result?.date ?? "unknown"}`,
    summary: `Analytics rollup ${result?.date}: ${result?.videos ?? 0} videos, ${result?.creators ?? 0} creators`
  });
  return c.json({ ...result, source: "db" });
});

/** Runs the privacy workers: data exports + due account deletions. */
adminOpsRoutes.post("/ops/privacy/run", requireAdmin("platform_superadmin", "admin"), async (c) => {
  const admin = c.get("admin")!;
  if (!isBackendConfigured()) {
    return c.json({ exports: { processed: 0 }, deletions: { processed: 0 }, source: "mock" });
  }
  const [exports, deletions] = [await processDataExports(), await processAccountDeletions()];
  await writeAuditLog(admin, {
    action: "privacy_workers_run",
    targetType: "platform_setting",
    targetId: "privacy_workers",
    summary: `Privacy workers: ${exports.ready} exports ready, ${deletions.completed} deletions completed`
  });
  return c.json({ exports, deletions, source: "db" });
});

const trendingBody = z.object({ window: z.enum(["daily", "weekly"]).default("daily") });

adminOpsRoutes.post("/ops/trending/run", requireAdmin("platform_superadmin", "admin"), async (c) => {
  const admin = c.get("admin")!;
  const body = trendingBody.parse(await c.req.json().catch(() => ({})));

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "trending_snapshot_run",
      targetType: "platform_setting",
      targetId: `trending_${body.window}`,
      summary: `Trending snapshot run (${body.window}, mock mode)`
    });
    return c.json({ captured: 0, window: body.window, source: "mock" });
  }

  const result = await computeTrendSnapshots(body.window);
  await writeAuditLog(admin, {
    action: "trending_snapshot_run",
    targetType: "platform_setting",
    targetId: `trending_${body.window}`,
    summary: `Trending snapshot run (${body.window}): ${result?.captured ?? 0} rows`
  });
  return c.json({ ...result, window: body.window, source: "db" });
});
