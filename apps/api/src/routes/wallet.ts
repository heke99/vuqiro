import { Hono } from "hono";
import { z } from "zod";
import { mockWallet, mockWalletTransactions } from "@vuqiro/mock-data";
import { badRequest, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const walletRoutes = new Hono<AppEnv>();

walletRoutes.use("*", attachUser);

walletRoutes.get("/", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ wallet: mockWallet, transactions: mockWalletTransactions, source: "mock" });
  }

  const db = getServiceDb()!;
  let { data: wallet } = await db
    .from("wallets")
    .select("id, coin_balance, locked_balance, updated_at")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!wallet) {
    const { data: created, error } = await db
      .from("wallets")
      .insert({ profile_id: profile.id })
      .select("id, coin_balance, locked_balance, updated_at")
      .single();
    if (error) throw badRequest(error.message);
    wallet = created;
  }

  const { data: transactions } = await db
    .from("coin_transactions")
    .select("id, type, amount, label, related_creator_id, related_video_id, created_at")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return c.json({ wallet, transactions: transactions ?? [], source: "db" });
});

const tipBody = z.object({
  creatorId: z.string().min(1).max(64),
  amount: z.number().int().positive().max(100_000),
  idempotencyKey: z.string().min(8).max(128)
});

/**
 * Sends a coin tip. The full atomic implementation (Postgres function with
 * balance checks, ledger + notification writes) lands in Batch 14; this
 * endpoint already enforces the contract: auth, validation, idempotency key,
 * rate limit, non-negative balance.
 */
walletRoutes.post("/tip", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`tip:${profile.id}`, 30, 60_000);
  const body = tipBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ ok: true, newBalance: mockWallet.coinBalance - body.amount, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: wallet } = await db
    .from("wallets")
    .select("id, coin_balance")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!wallet) throw notFound("Wallet not found");
  if (wallet.coin_balance < body.amount) throw badRequest("Insufficient coin balance");

  // Idempotency: a repeated key is a no-op success.
  const { data: existing } = await db
    .from("coin_transactions")
    .select("id")
    .eq("idempotency_key", body.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return c.json({ ok: true, duplicate: true, source: "db" });
  }

  const { error: txnError } = await db.from("coin_transactions").insert({
    wallet_id: wallet.id,
    type: "tip",
    amount: -body.amount,
    label: "Creator tip",
    related_creator_id: body.creatorId,
    idempotency_key: body.idempotencyKey
  });
  if (txnError) throw badRequest(txnError.message);

  const { error: balanceError } = await db
    .from("wallets")
    .update({ coin_balance: wallet.coin_balance - body.amount })
    .eq("id", wallet.id);
  if (balanceError) throw badRequest(balanceError.message);

  return c.json({ ok: true, newBalance: wallet.coin_balance - body.amount, source: "db" }, 201);
});

const unlockBody = z.object({
  videoId: z.string().min(1).max(64),
  idempotencyKey: z.string().min(8).max(128)
});

walletRoutes.post("/unlock", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`unlock:${profile.id}`, 30, 60_000);
  const body = unlockBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ ok: true, entitlementId: `mock_ent_${Date.now()}`, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: video } = await db
    .from("videos")
    .select("id, creator_id, visibility, coin_unlock_price, status, moderation_status")
    .eq("id", body.videoId)
    .maybeSingle();
  if (!video || video.status !== "ready") throw notFound("Video not available");
  if (video.visibility !== "unlock_with_coins" || !video.coin_unlock_price) {
    throw badRequest("Video is not coin-unlockable");
  }

  // Already entitled → no double charge.
  const { data: entitled } = await db
    .from("creator_membership_entitlements")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("video_id", video.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (entitled) return c.json({ ok: true, entitlementId: entitled.id, duplicate: true, source: "db" });

  const { data: wallet } = await db
    .from("wallets")
    .select("id, coin_balance")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!wallet) throw notFound("Wallet not found");
  if (wallet.coin_balance < video.coin_unlock_price) throw badRequest("Insufficient coin balance");

  const { data: existingTxn } = await db
    .from("coin_transactions")
    .select("id")
    .eq("idempotency_key", body.idempotencyKey)
    .maybeSingle();
  if (existingTxn) return c.json({ ok: true, duplicate: true, source: "db" });

  const { error: txnError } = await db.from("coin_transactions").insert({
    wallet_id: wallet.id,
    type: "unlock",
    amount: -video.coin_unlock_price,
    label: "Video unlock",
    related_video_id: video.id,
    related_creator_id: video.creator_id,
    idempotency_key: body.idempotencyKey
  });
  if (txnError) throw badRequest(txnError.message);

  await db.from("wallets").update({ coin_balance: wallet.coin_balance - video.coin_unlock_price }).eq("id", wallet.id);

  const { data: entitlement, error: entError } = await db
    .from("creator_membership_entitlements")
    .insert({ profile_id: profile.id, video_id: video.id, creator_id: video.creator_id, source: "coin_unlock" })
    .select("id")
    .single();
  if (entError) throw badRequest(entError.message);

  return c.json({ ok: true, entitlementId: entitlement.id, source: "db" }, 201);
});
