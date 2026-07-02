import { getServiceDb } from "./supabase";

/** Platform fee for coin-based creator earnings (tips/unlocks). */
export const COIN_PLATFORM_FEE_PERCENT = 20;
/** Estimated store fee already paid on the coin purchase. */
export const COIN_STORE_FEE_PERCENT = 15;

export function coinsToUsd(coins: number): number {
  return Math.round(coins) / 100;
}

export type LedgerSplit = {
  grossAmount: number;
  platformFeeAmount: number;
  storeFeeAmount: number;
  netAmount: number;
};

export function splitCoinRevenue(coins: number): LedgerSplit {
  const gross = coinsToUsd(coins);
  const platformFee = Number(((gross * COIN_PLATFORM_FEE_PERCENT) / 100).toFixed(2));
  const storeFee = Number(((gross * COIN_STORE_FEE_PERCENT) / 100).toFixed(2));
  const net = Number((gross - platformFee - storeFee).toFixed(2));
  return { grossAmount: gross, platformFeeAmount: platformFee, storeFeeAmount: storeFee, netAmount: net };
}

/**
 * Records creator earnings from a coin spend (tip or unlock) in the revenue
 * ledger. Called after the atomic wallet spend succeeds.
 */
export async function recordCoinEarning(params: {
  creatorId: string;
  source: "tip" | "unlock";
  coins: number;
  relatedVideoId?: string;
}): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  const split = splitCoinRevenue(params.coins);
  const { error } = await db.from("creator_revenue_ledger").insert({
    creator_id: params.creatorId,
    source: params.source,
    gross_amount: split.grossAmount,
    platform_fee_amount: split.platformFeeAmount,
    store_fee_amount: split.storeFeeAmount,
    net_amount: split.netAmount,
    currency: "USD",
    status: "pending",
    related_video_id: params.relatedVideoId ?? null
  });
  if (error) {
    console.error("[ledger] earning record failed:", error.message);
  }
}

/** Creates an in-app notification for a creator earning event. */
export async function notifyCreator(params: {
  creatorId: string;
  type: "coin_received" | "video_unlocked";
  title: string;
  body: string;
  relatedVideoId?: string;
}): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  const { data: creator } = await db
    .from("creators")
    .select("profile_id")
    .eq("id", params.creatorId)
    .maybeSingle();
  if (!creator) return;

  // Respect notification preferences (purchases toggle).
  const { data: prefs } = await db
    .from("notification_preferences")
    .select("purchases")
    .eq("profile_id", creator.profile_id)
    .maybeSingle();
  if (prefs && prefs.purchases === false) return;

  await db.from("notifications").insert({
    profile_id: creator.profile_id,
    type: params.type,
    title: params.title,
    body: params.body,
    related_video_id: params.relatedVideoId ?? null
  });
}
