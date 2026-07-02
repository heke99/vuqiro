import { Hono } from "hono";
import { loadEnv } from "@vuqiro/config";
import { unauthorized } from "../lib/errors";
import { processRevenueCatEvent, type RevenueCatEvent } from "../lib/revenuecatProcessor";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";

export const webhookRoutes = new Hono();

/**
 * RevenueCat webhook.
 *
 * Authentication: RevenueCat sends the configured Authorization header value;
 * it must equal REVENUECAT_WEBHOOK_SECRET. Events are stored first
 * (idempotent on event id) and then processed — full entitlement/coin
 * processing is implemented in Batch 13.
 */
webhookRoutes.post("/revenuecat/webhook", async (c) => {
  const env = loadEnv();
  if (!env.revenueCatWebhookSecret) {
    // Never accept unauthenticated purchase events.
    throw unauthorized("RevenueCat webhook secret not configured");
  }
  const header = c.req.header("authorization");
  if (header !== env.revenueCatWebhookSecret && header !== `Bearer ${env.revenueCatWebhookSecret}`) {
    throw unauthorized("Invalid webhook credentials");
  }

  const payload = (await c.req.json()) as { event?: RevenueCatEvent };
  const event = payload.event;
  if (!event?.id || !event.type) {
    return c.json({ error: "Malformed event" }, 400);
  }

  if (!isBackendConfigured()) {
    return c.json({ received: true, processed: false, reason: "backend not configured" });
  }

  const db = getServiceDb()!;
  // Idempotency: unique event_id. A duplicate insert means we already
  // processed (or are processing) this event — never double-credit.
  const { error } = await db.from("revenuecat_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    app_user_id: event.app_user_id,
    payload
  });
  if (error) {
    if (error.code === "23505") {
      return c.json({ received: true, duplicate: true });
    }
    return c.json({ error: error.message }, 500);
  }

  const result = await processRevenueCatEvent(event);
  await db
    .from("revenuecat_webhook_events")
    .update({
      status: result.status === "processed" ? "processed" : result.status === "skipped" ? "skipped" : "error",
      error_message: result.status === "error" ? result.detail : null,
      processed_at: new Date().toISOString()
    })
    .eq("event_id", event.id);

  // Always 200 so RevenueCat does not retry storms; errors are recorded and
  // can be replayed from the stored payload.
  return c.json({ received: true, result });
});

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payouts_enabled?: boolean;
      requirements?: { currently_due?: string[]; disabled_reason?: string | null };
      metadata?: Record<string, string>;
      destination?: string;
      amount?: number;
    };
  };
};

/**
 * Stripe webhook. Signature-verified (HMAC over `t.rawBody`, replay-window
 * checked), idempotent on the Stripe event id, then processed:
 *   account.updated    -> sync creator payout account status
 *   transfer.reversed  -> mark the payout failed for review
 */
webhookRoutes.post("/stripe/webhook", async (c) => {
  const env = loadEnv();
  if (!env.stripeWebhookSecret) {
    throw unauthorized("Stripe webhook secret not configured");
  }
  const rawBody = await c.req.text();
  const { StripePayoutsProvider } = await import("@vuqiro/services");
  const verifier = new StripePayoutsProvider({
    secretKey: env.stripeSecretKey ?? "unused-for-verification",
    webhookSecret: env.stripeWebhookSecret
  });
  const verification = verifier.verifyWebhookSignature(rawBody, c.req.header("stripe-signature"));
  if (!verification.valid) {
    throw unauthorized(verification.reason ?? "Invalid Stripe signature");
  }

  const event = JSON.parse(rawBody) as StripeEvent;
  if (!event.id || !event.type) {
    return c.json({ error: "Malformed event" }, 400);
  }

  if (!isBackendConfigured()) {
    return c.json({ received: true, processed: false, reason: "backend not configured" });
  }

  const db = getServiceDb()!;
  // Idempotency: unique (provider, provider_event_id).
  const { error: insertError } = await db.from("purchase_events").insert({
    provider: "stripe",
    provider_event_id: event.id,
    event_type: event.type,
    payload: event
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return c.json({ received: true, duplicate: true });
    }
    return c.json({ error: insertError.message }, 500);
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object;
      const status = account.payouts_enabled
        ? "verified"
        : account.requirements?.disabled_reason
          ? "restricted"
          : "onboarding_started";
      await db
        .from("creator_payout_accounts")
        .update({
          status,
          payouts_enabled: account.payouts_enabled ?? false,
          requirements_due: account.requirements?.currently_due ?? []
        })
        .eq("provider_account_id", account.id);
      break;
    }
    case "transfer.reversed": {
      await db
        .from("creator_payouts")
        .update({ status: "failed", failure_reason: "Transfer reversed by Stripe" })
        .eq("provider_transfer_id", event.data.object.id);
      break;
    }
    default:
      break;
  }

  await db
    .from("purchase_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "stripe")
    .eq("provider_event_id", event.id);

  return c.json({ received: true, type: event.type });
});
