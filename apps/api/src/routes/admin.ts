import { Hono } from "hono";
import { z } from "zod";
import {
  mockAdminMetrics,
  mockModerationCases,
  mockPackages,
  mockPackageVersions,
  mockPayouts,
  mockReports
} from "@vuqiro/mock-data";
import { writeAuditLog } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

export const adminRoutes = new Hono<AppEnv>();

// All admin routes require an active admin. Finance actions additionally
// require superadmin/finance roles; see per-route middleware.
adminRoutes.use("*", requireAdmin());

adminRoutes.get("/dashboard", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ metrics: mockAdminMetrics, source: "mock" });
  }
  const db = getServiceDb()!;
  const [users, creators, videos, underReview, cases, memberships, payoutsPending, payoutsHeld] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("creators").select("id", { count: "exact", head: true }),
      db.from("videos").select("id", { count: "exact", head: true }),
      db.from("videos").select("id", { count: "exact", head: true }).eq("moderation_status", "under_review"),
      db.from("moderation_cases").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]),
      db.from("creator_memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("creator_payouts").select("id", { count: "exact", head: true }).in("status", ["pending", "payable"]),
      db.from("creator_payouts").select("id", { count: "exact", head: true }).eq("status", "held")
    ]);

  return c.json({
    metrics: {
      totalUsers: users.count ?? 0,
      totalCreators: creators.count ?? 0,
      videosUploaded: videos.count ?? 0,
      videosUnderReview: underReview.count ?? 0,
      reportedContent: cases.count ?? 0,
      activeSubscriptions: memberships.count ?? 0,
      pendingPayouts: payoutsPending.count ?? 0,
      heldPayouts: payoutsHeld.count ?? 0
    },
    source: "db"
  });
});

adminRoutes.get("/moderation", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ cases: mockModerationCases, reports: mockReports, source: "mock" });
  }
  const db = getServiceDb()!;
  const [{ data: cases, error }, { data: reports }] = await Promise.all([
    db.from("moderation_cases").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("reports").select("*").order("created_at", { ascending: false }).limit(100)
  ]);
  if (error) throw badRequest(error.message);
  return c.json({ cases: cases ?? [], reports: reports ?? [], source: "db" });
});

adminRoutes.get("/monetization/packages", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ packages: mockPackages, versions: mockPackageVersions, source: "mock" });
  }
  const db = getServiceDb()!;
  const [{ data: packages, error }, { data: versions }] = await Promise.all([
    db.from("monetization_packages").select("*").order("created_at"),
    db.from("monetization_package_versions").select("*").order("created_at")
  ]);
  if (error) throw badRequest(error.message);
  return c.json({ packages: packages ?? [], versions: versions ?? [], source: "db" });
});

const packageVersionBody = z.object({
  packageId: z.string().min(1),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  priceAmount: z.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  billingPeriod: z.enum(["one_time", "monthly", "yearly"]),
  coinsAmount: z.number().int().positive().optional(),
  bonusCoinsAmount: z.number().int().nonnegative().optional(),
  platformFeePercent: z.number().min(0).max(100).default(20),
  creatorSharePercent: z.number().min(0).max(100).default(80)
});

adminRoutes.post("/monetization/package-versions", requireAdmin("platform_superadmin", "admin", "finance"), async (c) => {
  const admin = c.get("admin")!;
  const body = packageVersionBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "price_version_create",
      targetType: "package",
      targetId: body.packageId,
      summary: `Created price version "${body.displayName}" (mock mode)`
    });
    return c.json({ version: { id: `mock_ver_${Date.now()}`, ...body }, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: latest } = await db
    .from("monetization_package_versions")
    .select("version_number")
    .eq("package_id", body.packageId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("monetization_package_versions")
    .insert({
      package_id: body.packageId,
      version_number: (latest?.version_number ?? 0) + 1,
      display_name: body.displayName,
      description: body.description,
      price_amount: body.priceAmount,
      currency: body.currency,
      billing_period: body.billingPeriod,
      coins_amount: body.coinsAmount,
      bonus_coins_amount: body.bonusCoinsAmount,
      platform_fee_percent: body.platformFeePercent,
      creator_share_percent: body.creatorSharePercent
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "price_version_create",
    targetType: "package_version",
    targetId: data.id,
    summary: `Created price version "${body.displayName}" v${data.version_number}`
  });

  return c.json({ version: data, source: "db" }, 201);
});

const holdBody = z.object({
  reason: z
    .enum(["moderation_case", "fraud_review", "refund_risk", "creator_verification_missing", "manual_admin_hold", "legal_review"])
    .default("manual_admin_hold"),
  note: z.string().trim().max(1000).optional()
});

adminRoutes.post("/payouts/:id/hold", requireAdmin("platform_superadmin", "finance"), async (c) => {
  const admin = c.get("admin")!;
  const payoutId = z.string().min(1).parse(c.req.param("id"));
  const body = holdBody.parse(await c.req.json().catch(() => ({})));

  if (!isBackendConfigured()) {
    const payout = mockPayouts.find((candidate) => candidate.id === payoutId);
    if (!payout) throw notFound("Payout not found");
    await writeAuditLog(admin, {
      action: "payout_hold",
      targetType: "payout",
      targetId: payoutId,
      summary: `Held payout (${body.reason}) — mock mode`
    });
    return c.json({ payout: { ...payout, status: "held" }, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: payout } = await db.from("creator_payouts").select("id, creator_id, status").eq("id", payoutId).maybeSingle();
  if (!payout) throw notFound("Payout not found");
  if (payout.status === "paid") throw badRequest("Cannot hold a paid payout");

  const { error } = await db.from("creator_payouts").update({ status: "held" }).eq("id", payoutId);
  if (error) throw badRequest(error.message);

  await db.from("payout_holds").insert({
    creator_id: payout.creator_id,
    payout_id: payoutId,
    reason: body.reason,
    note: body.note,
    placed_by: admin.id
  });

  await writeAuditLog(admin, {
    action: "payout_hold",
    targetType: "payout",
    targetId: payoutId,
    summary: `Held payout for creator ${payout.creator_id} (${body.reason})`
  });

  return c.json({ payoutId, status: "held", source: "db" });
});

adminRoutes.post("/payouts/:id/release", requireAdmin("platform_superadmin", "finance"), async (c) => {
  const admin = c.get("admin")!;
  const payoutId = z.string().min(1).parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    const payout = mockPayouts.find((candidate) => candidate.id === payoutId);
    if (!payout) throw notFound("Payout not found");
    await writeAuditLog(admin, {
      action: "payout_release",
      targetType: "payout",
      targetId: payoutId,
      summary: "Released payout — mock mode"
    });
    return c.json({ payout: { ...payout, status: "payable" }, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: payout } = await db.from("creator_payouts").select("id, creator_id, status").eq("id", payoutId).maybeSingle();
  if (!payout) throw notFound("Payout not found");
  if (payout.status !== "held") throw badRequest("Payout is not held");

  const { error } = await db.from("creator_payouts").update({ status: "payable" }).eq("id", payoutId);
  if (error) throw badRequest(error.message);

  await db
    .from("payout_holds")
    .update({ released_by: admin.id, released_at: new Date().toISOString() })
    .eq("payout_id", payoutId)
    .is("released_at", null);

  await writeAuditLog(admin, {
    action: "payout_release",
    targetType: "payout",
    targetId: payoutId,
    summary: `Released payout for creator ${payout.creator_id}`
  });

  return c.json({ payoutId, status: "payable", source: "db" });
});
