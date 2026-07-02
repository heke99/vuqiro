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

/**
 * Stripe webhook. Signature verification + processing is implemented with
 * the payout batch (Batch 15); until then the endpoint refuses unsigned
 * calls so it can be registered safely.
 */
webhookRoutes.post("/stripe/webhook", async (c) => {
  const env = loadEnv();
  if (!env.stripeWebhookSecret) {
    throw unauthorized("Stripe webhook secret not configured");
  }
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    throw unauthorized("Missing stripe-signature header");
  }
  // Full verification via stripe.webhooks.constructEvent lands in Batch 15.
  return c.json({ received: true, processed: false, reason: "processing lands in Batch 15" });
});
