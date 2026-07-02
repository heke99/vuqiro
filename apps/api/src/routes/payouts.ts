import { Hono } from "hono";
import { z } from "zod";
import { getPayoutsProvider } from "@vuqiro/services";
import { loadEnv } from "@vuqiro/config";
import { writeAuditLog } from "../lib/audit";
import { badRequest, forbidden } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireAdmin, requireUser } from "../middleware/auth";

export const payoutRoutes = new Hono<AppEnv>();

/** Minimum payable balance (USD) required to be included in a payout batch. */
export const MINIMUM_PAYOUT_USD = 25;

// ---------------------------------------------------------------------------
// Creator-facing
// ---------------------------------------------------------------------------

payoutRoutes.use("/payouts/*", attachUser);

/**
 * Starts (or resumes) Stripe Connect onboarding for the calling creator.
 */
payoutRoutes.post("/payouts/onboarding", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`payout-onboarding:${profile.id}`, 10, 3_600_000);
  const provider = getPayoutsProvider();
  const env = loadEnv();
  const returnUrl = `${env.apiBaseUrl}/payouts/onboarding/complete`;

  if (!isBackendConfigured()) {
    const { accountId } = await provider.createConnectedAccount(profile.id, `${profile.handle}@example.com`);
    const link = await provider.createOnboardingLink(accountId, returnUrl, returnUrl);
    return c.json({ accountId, onboardingUrl: link.url, expiresAt: link.expiresAt, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: creator } = await db.from("creators").select("id").eq("profile_id", profile.id).maybeSingle();
  if (!creator) throw forbidden("Complete creator onboarding first");

  let { data: account } = await db
    .from("creator_payout_accounts")
    .select("id, provider_account_id, status")
    .eq("creator_id", creator.id)
    .maybeSingle();

  if (!account?.provider_account_id) {
    const created = await provider.createConnectedAccount(creator.id, `${profile.handle}@vuqiro.app`);
    if (account) {
      await db
        .from("creator_payout_accounts")
        .update({ provider_account_id: created.accountId, status: "onboarding_started" })
        .eq("id", account.id);
      account = { ...account, provider_account_id: created.accountId };
    } else {
      const { data: inserted, error } = await db
        .from("creator_payout_accounts")
        .insert({ creator_id: creator.id, provider_account_id: created.accountId, status: "onboarding_started" })
        .select("id, provider_account_id, status")
        .single();
      if (error) throw badRequest(error.message);
      account = inserted;
    }
  }

  const link = await provider.createOnboardingLink(account.provider_account_id!, returnUrl, returnUrl);
  return c.json({ accountId: account.provider_account_id, onboardingUrl: link.url, expiresAt: link.expiresAt, source: "db" }, 201);
});

/** The calling creator's payout dashboard data. */
payoutRoutes.get("/payouts/me", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({
      account: { status: "not_onboarded", payoutsEnabled: false },
      payableBalance: 0,
      pendingBalance: 0,
      payouts: [],
      holds: [],
      minimumPayout: MINIMUM_PAYOUT_USD,
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const { data: creator } = await db.from("creators").select("id").eq("profile_id", profile.id).maybeSingle();
  if (!creator) throw forbidden("Not a creator account");

  const [{ data: account }, { data: ledger }, { data: payouts }, { data: holds }] = await Promise.all([
    db
      .from("creator_payout_accounts")
      .select("provider_account_id, status, payouts_enabled")
      .eq("creator_id", creator.id)
      .maybeSingle(),
    db.from("creator_revenue_ledger").select("status, net_amount").eq("creator_id", creator.id),
    db
      .from("creator_payouts")
      .select("id, amount, currency, status, failure_reason, batch_id, created_at, paid_at")
      .eq("creator_id", creator.id)
      .order("created_at", { ascending: false })
      .limit(24),
    db.from("payout_holds").select("id, reason, note, created_at").eq("creator_id", creator.id).is("released_at", null)
  ]);

  // Live-sync account status from the provider when possible.
  let accountSummary: { status: string; payoutsEnabled: boolean } = account
    ? { status: account.status, payoutsEnabled: account.payouts_enabled }
    : { status: "not_onboarded", payoutsEnabled: false };
  if (account?.provider_account_id) {
    try {
      const summary = await getPayoutsProvider().getAccountSummary(account.provider_account_id);
      accountSummary = { status: summary.status, payoutsEnabled: summary.payoutsEnabled };
      await db
        .from("creator_payout_accounts")
        .update({ status: summary.status, payouts_enabled: summary.payoutsEnabled, requirements_due: summary.requirementsDue })
        .eq("creator_id", creator.id);
    } catch {
      // keep stored status on provider errors
    }
  }

  const sumByStatus = (status: string) =>
    (ledger ?? [])
      .filter((entry) => entry.status === status)
      .reduce((sum, entry) => sum + Number(entry.net_amount), 0);

  return c.json({
    account: accountSummary,
    payableBalance: Number(sumByStatus("payable").toFixed(2)),
    pendingBalance: Number(sumByStatus("pending").toFixed(2)),
    heldBalance: Number(sumByStatus("held").toFixed(2)),
    payouts: payouts ?? [],
    holds: holds ?? [],
    minimumPayout: MINIMUM_PAYOUT_USD,
    source: "db"
  });
});

// ---------------------------------------------------------------------------
// Admin: payout batches
// ---------------------------------------------------------------------------

const batchBody = z.object({
  batchId: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .regex(/^[a-z0-9_\-]+$/i)
});

/**
 * Creates and executes a payout batch: every creator with a verified account,
 * payable ledger ≥ minimum and no active hold gets one payout. Transfers use
 * batch-scoped idempotency keys; ledger entries move to paid; failures are
 * recorded per creator. Fully audit-logged.
 */
payoutRoutes.post("/admin/payouts/batch", requireAdmin("platform_superadmin", "finance"), async (c) => {
  const admin = c.get("admin")!;
  const body = batchBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "payout_create",
      targetType: "payout_batch",
      targetId: body.batchId,
      summary: `Created payout batch ${body.batchId} (mock mode)`
    });
    return c.json({ batchId: body.batchId, created: 2, paid: 2, failed: 0, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const provider = getPayoutsProvider();

  // Duplicate batch protection.
  const { data: existingBatch } = await db
    .from("creator_payouts")
    .select("id")
    .eq("batch_id", body.batchId)
    .limit(1)
    .maybeSingle();
  if (existingBatch) throw badRequest(`Batch ${body.batchId} already exists`);

  // Aggregate payable ledger per creator.
  const { data: ledger } = await db
    .from("creator_revenue_ledger")
    .select("id, creator_id, net_amount")
    .eq("status", "payable");
  const byCreator = new Map<string, { total: number; entryIds: string[] }>();
  for (const entry of ledger ?? []) {
    const bucket = byCreator.get(entry.creator_id) ?? { total: 0, entryIds: [] };
    bucket.total += Number(entry.net_amount);
    bucket.entryIds.push(entry.id);
    byCreator.set(entry.creator_id, bucket);
  }

  const { data: holds } = await db.from("payout_holds").select("creator_id").is("released_at", null);
  const heldCreators = new Set((holds ?? []).map((hold) => hold.creator_id));

  let created = 0;
  let paid = 0;
  let failed = 0;
  let skipped = 0;

  for (const [creatorId, bucket] of byCreator) {
    if (bucket.total < MINIMUM_PAYOUT_USD || heldCreators.has(creatorId)) {
      skipped += 1;
      continue;
    }
    const { data: account } = await db
      .from("creator_payout_accounts")
      .select("provider_account_id, payouts_enabled")
      .eq("creator_id", creatorId)
      .maybeSingle();
    if (!account?.provider_account_id || !account.payouts_enabled) {
      skipped += 1;
      continue;
    }

    const amount = Number(bucket.total.toFixed(2));
    const idempotencyKey = `batch:${body.batchId}:${creatorId}`;
    const { data: payout, error: payoutError } = await db
      .from("creator_payouts")
      .insert({
        creator_id: creatorId,
        amount,
        currency: "USD",
        status: "processing",
        batch_id: body.batchId,
        idempotency_key: idempotencyKey
      })
      .select("id")
      .single();
    if (payoutError) {
      // unique idempotency key → already created in a previous partial run
      skipped += 1;
      continue;
    }
    created += 1;

    const transfer = await provider.createTransfer(account.provider_account_id, Math.round(amount * 100), "USD", idempotencyKey);
    if (transfer.status === "failed") {
      failed += 1;
      await db
        .from("creator_payouts")
        .update({ status: "failed", failure_reason: transfer.errorMessage })
        .eq("id", payout.id);
    } else {
      paid += 1;
      await db
        .from("creator_payouts")
        .update({
          status: transfer.status === "paid" ? "paid" : "processing",
          provider_transfer_id: transfer.transferId,
          paid_at: transfer.status === "paid" ? new Date().toISOString() : null
        })
        .eq("id", payout.id);
      await db
        .from("creator_revenue_ledger")
        .update({ status: "paid", payout_id: payout.id })
        .in("id", bucket.entryIds);
    }
  }

  await writeAuditLog(admin, {
    action: "payout_create",
    targetType: "payout_batch",
    targetId: body.batchId,
    summary: `Payout batch ${body.batchId}: ${created} created, ${paid} paid/processing, ${failed} failed, ${skipped} skipped`,
    metadata: { created, paid, failed, skipped }
  });

  return c.json({ batchId: body.batchId, created, paid, failed, skipped, source: "db" }, 201);
});
