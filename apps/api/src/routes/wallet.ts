import { Hono } from "hono";
import { z } from "zod";
import { mockWallet, mockWalletTransactions } from "@vuqiro/mock-data";
import { recordCoinEarning, notifyCreator } from "../lib/creatorLedger";
import { badRequest, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const walletRoutes = new Hono<AppEnv>();

walletRoutes.use("*", attachUser);

type SpendResult = { transaction_id: string; new_balance: number; duplicate: boolean };

/**
 * Runs the atomic wallet_spend Postgres function: row-locked balance check,
 * deduction and transaction insert in one transaction, idempotent on key.
 */
async function atomicSpend(params: {
  profileId: string;
  amount: number;
  type: "tip" | "unlock" | "boost";
  label: string;
  idempotencyKey: string;
  creatorId?: string;
  videoId?: string;
}): Promise<SpendResult> {
  const db = getServiceDb()!;
  const { data, error } = await db.rpc("wallet_spend", {
    p_profile_id: params.profileId,
    p_amount: params.amount,
    p_type: params.type,
    p_label: params.label,
    p_idempotency_key: params.idempotencyKey,
    p_related_creator_id: params.creatorId ?? null,
    p_related_video_id: params.videoId ?? null
  });
  if (error) {
    if (error.message.includes("insufficient balance")) {
      throw badRequest("Insufficient coin balance");
    }
    throw badRequest(error.message);
  }
  const row = (data as SpendResult[])[0];
  if (!row) throw badRequest("Spend failed");
  return row;
}

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

walletRoutes.post("/tip", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`tip:${profile.id}`, 30, 60_000);
  const body = tipBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ ok: true, newBalance: mockWallet.coinBalance - body.amount, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: creator } = await db
    .from("creators")
    .select("id, monetization_enabled, profiles (display_name, status)")
    .eq("id", body.creatorId)
    .maybeSingle();
  if (!creator) throw notFound("Creator not found");
  const creatorProfile = creator.profiles as { display_name?: string; status?: string } | null;
  if (creatorProfile?.status !== "active") throw badRequest("This creator cannot receive tips");

  const result = await atomicSpend({
    profileId: profile.id,
    amount: body.amount,
    type: "tip",
    label: "Creator tip",
    idempotencyKey: body.idempotencyKey,
    creatorId: body.creatorId
  });

  if (!result.duplicate) {
    await recordCoinEarning({ creatorId: body.creatorId, source: "tip", coins: body.amount });
    await notifyCreator({
      creatorId: body.creatorId,
      type: "coin_received",
      title: "Coins received",
      body: `@${profile.handle} sent you ${body.amount} coins.`
    });
  }

  return c.json({ ok: true, newBalance: result.new_balance, duplicate: result.duplicate, source: "db" }, 201);
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
    .select("id, creator_id, visibility, coin_unlock_price, status, moderation_status, caption")
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

  const result = await atomicSpend({
    profileId: profile.id,
    amount: video.coin_unlock_price,
    type: "unlock",
    label: "Video unlock",
    idempotencyKey: body.idempotencyKey,
    creatorId: video.creator_id,
    videoId: video.id
  });

  if (result.duplicate) {
    return c.json({ ok: true, duplicate: true, source: "db" });
  }

  const { data: entitlement, error: entError } = await db
    .from("creator_membership_entitlements")
    .insert({ profile_id: profile.id, video_id: video.id, creator_id: video.creator_id, source: "coin_unlock" })
    .select("id")
    .single();
  if (entError) throw badRequest(entError.message);

  await recordCoinEarning({
    creatorId: video.creator_id,
    source: "unlock",
    coins: video.coin_unlock_price,
    relatedVideoId: video.id
  });
  await notifyCreator({
    creatorId: video.creator_id,
    type: "video_unlocked",
    title: "Video unlocked",
    body: `@${profile.handle} unlocked "${video.caption.slice(0, 60)}".`,
    relatedVideoId: video.id
  });

  return c.json({ ok: true, entitlementId: entitlement.id, newBalance: result.new_balance, source: "db" }, 201);
});

const boostBody = z.object({
  videoId: z.string().min(1).max(64),
  coins: z.number().int().positive().max(100_000),
  idempotencyKey: z.string().min(8).max(128)
});

/**
 * Boost flow. Boosts require the target video to pass safety checks —
 * paid reach can never bypass moderation.
 */
walletRoutes.post("/boost", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`boost:${profile.id}`, 10, 3_600_000);
  const body = boostBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ ok: true, campaignId: `mock_boost_${Date.now()}`, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: video } = await db
    .from("videos")
    .select("id, status, moderation_status, safety_score, report_count")
    .eq("id", body.videoId)
    .maybeSingle();
  if (!video || video.status !== "ready") throw notFound("Video not available");
  // Moderation eligibility gate.
  if (video.moderation_status !== "visible" || (video.safety_score ?? 0) < 80 || (video.report_count ?? 0) > 0) {
    throw badRequest("This video is not eligible for boosting");
  }

  const result = await atomicSpend({
    profileId: profile.id,
    amount: body.coins,
    type: "boost",
    label: "Video boost",
    idempotencyKey: body.idempotencyKey,
    videoId: video.id
  });

  if (result.duplicate) {
    return c.json({ ok: true, duplicate: true, source: "db" });
  }

  const { data: campaign, error } = await db
    .from("boost_campaigns")
    .insert({
      video_id: video.id,
      purchaser_profile_id: profile.id,
      coins_spent: body.coins,
      impressions_target: body.coins * 40 // delivery target heuristic
    })
    .select("id")
    .single();
  if (error) throw badRequest(error.message);

  return c.json({ ok: true, campaignId: campaign.id, newBalance: result.new_balance, source: "db" }, 201);
});
