import { Hono } from "hono";
import { z } from "zod";
import { mockLedgerEntries, mockWalletTransactions } from "@vuqiro/mock-data";
import { writeAuditLog } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

/**
 * Finance administration: wallet transactions, purchases, creator revenue
 * ledger and manual wallet adjustments (finance/superadmin only, audited,
 * routed through the atomic wallet functions — never direct balance writes).
 */
export const adminFinanceRoutes = new Hono<AppEnv>();

adminFinanceRoutes.use("*", requireAdmin("platform_superadmin", "admin", "finance"));

adminFinanceRoutes.get("/wallet/transactions", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ transactions: mockWalletTransactions, source: "mock" });
  }
  const db = getServiceDb()!;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "100"), 1), 500);
  let query = db
    .from("coin_transactions")
    .select("*, wallets (profile_id, profiles (handle))")
    .order("created_at", { ascending: false })
    .limit(limit);
  const type = c.req.query("type");
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ transactions: data ?? [], source: "db" });
});

adminFinanceRoutes.get("/purchases", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ purchases: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "100"), 1), 500);
  let query = db
    .from("purchases")
    .select("*, profiles (handle)")
    .order("created_at", { ascending: false })
    .limit(limit);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ purchases: data ?? [], source: "db" });
});

adminFinanceRoutes.get("/revenue/creator-ledger", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ entries: mockLedgerEntries, source: "mock" });
  }
  const db = getServiceDb()!;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "100"), 1), 500);
  let query = db
    .from("creator_revenue_ledger")
    .select("*, creators (profiles (handle))")
    .order("created_at", { ascending: false })
    .limit(limit);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ entries: data ?? [], source: "db" });
});

const adjustmentBody = z.object({
  profileId: z.string().min(1),
  amount: z.number().int(),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().min(8).max(120)
});

/**
 * Manual wallet adjustment. Goes through wallet_credit/wallet_reverse — the
 * balance itself is never written directly, and every adjustment is audited.
 */
adminFinanceRoutes.post("/wallet/adjust", requireAdmin("platform_superadmin", "finance"), async (c) => {
  const admin = c.get("admin")!;
  const body = adjustmentBody.parse(await c.req.json());
  if (body.amount === 0) throw badRequest("Adjustment amount cannot be zero");

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "wallet_manual_adjustment",
      targetType: "wallet",
      targetId: body.profileId,
      summary: `Manual adjustment ${body.amount} coins (mock mode): ${body.reason}`
    });
    return c.json({ profileId: body.profileId, amount: body.amount, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: profile } = await db.from("profiles").select("id, handle").eq("id", body.profileId).maybeSingle();
  if (!profile) throw notFound("Profile not found");

  const rpc =
    body.amount > 0
      ? db.rpc("wallet_credit", {
          p_profile_id: body.profileId,
          p_amount: body.amount,
          p_type: "admin_adjustment",
          p_label: `Admin adjustment: ${body.reason}`,
          p_idempotency_key: body.idempotencyKey
        })
      : db.rpc("wallet_reverse", {
          p_profile_id: body.profileId,
          p_amount: Math.abs(body.amount),
          p_label: `Admin adjustment: ${body.reason}`,
          p_idempotency_key: body.idempotencyKey
        });
  const { data, error } = await rpc;
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "wallet_manual_adjustment",
    targetType: "wallet",
    targetId: body.profileId,
    summary: `Manual adjustment ${body.amount} coins for @${profile.handle}: ${body.reason}`,
    metadata: { idempotencyKey: body.idempotencyKey }
  });
  return c.json({ profileId: body.profileId, amount: body.amount, result: data, source: "db" }, 201);
});
