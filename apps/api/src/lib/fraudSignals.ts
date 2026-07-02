import { getServiceDb } from "./supabase";

export type FraudSignalType =
  | "repeated_reports"
  | "suspicious_wallet_activity"
  | "rapid_uploads"
  | "engagement_anomaly"
  | "chargeback_risk"
  | "multi_account";

/**
 * Raises a fraud/safety signal for the admin dashboard. Duplicate open
 * signals of the same type+target are collapsed (metadata updated instead).
 */
export async function raiseFraudSignal(params: {
  type: FraudSignalType;
  severity: "low" | "medium" | "high";
  targetType: "user" | "creator" | "video";
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const { data: existing } = await db
    .from("fraud_signals")
    .select("id")
    .eq("type", params.type)
    .eq("target_type", params.targetType)
    .eq("target_id", params.targetId)
    .in("status", ["open", "reviewing"])
    .maybeSingle();

  if (existing) {
    await db
      .from("fraud_signals")
      .update({ severity: params.severity, summary: params.summary, metadata: params.metadata ?? {} })
      .eq("id", existing.id);
    return;
  }

  const { error } = await db.from("fraud_signals").insert({
    type: params.type,
    severity: params.severity,
    target_type: params.targetType,
    target_id: params.targetId,
    summary: params.summary,
    metadata: params.metadata ?? {}
  });
  if (error) {
    console.error("[fraud] signal insert failed:", error.message);
  }
}

/**
 * Repeated-reports detector: when a target accumulates ≥ threshold reports
 * from distinct reporters in 72h, raise a high-severity signal.
 */
export async function checkRepeatedReports(targetType: string, targetId: string): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  const since = new Date(Date.now() - 72 * 3_600_000).toISOString();
  const { data } = await db
    .from("reports")
    .select("reporter_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .gte("created_at", since);
  const distinctReporters = new Set((data ?? []).map((row) => row.reporter_id)).size;
  if (distinctReporters >= 5) {
    await raiseFraudSignal({
      type: "repeated_reports",
      severity: "high",
      targetType: targetType === "video" ? "video" : targetType === "creator" ? "creator" : "user",
      targetId,
      summary: `${distinctReporters} distinct reporters in 72h`,
      metadata: { distinctReporters }
    });
  }
}

/**
 * Suspicious wallet detector: rapid purchase/refund alternation.
 */
export async function checkSuspiciousWallet(profileId: string): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const { data: wallet } = await db.from("wallets").select("id").eq("profile_id", profileId).maybeSingle();
  if (!wallet) return;
  const { data } = await db
    .from("coin_transactions")
    .select("type")
    .eq("wallet_id", wallet.id)
    .gte("created_at", since);
  const refunds = (data ?? []).filter((row) => row.type === "refund" || row.type === "reversal").length;
  const purchases = (data ?? []).filter((row) => row.type === "purchase").length;
  if (refunds >= 2 && purchases >= 2) {
    await raiseFraudSignal({
      type: "suspicious_wallet_activity",
      severity: "medium",
      targetType: "user",
      targetId: profileId,
      summary: `${purchases} purchases and ${refunds} refunds/reversals within 7 days`,
      metadata: { purchases, refunds }
    });
  }
}

/**
 * Rapid-upload detector: unusually many uploads per hour.
 */
export async function checkRapidUploads(creatorId: string): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .gte("created_at", since);
  if ((count ?? 0) >= 8) {
    await raiseFraudSignal({
      type: "rapid_uploads",
      severity: "low",
      targetType: "creator",
      targetId: creatorId,
      summary: `${count} uploads in the last hour`,
      metadata: { uploadsLastHour: count }
    });
  }
}
