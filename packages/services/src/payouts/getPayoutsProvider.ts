import { loadEnv } from "@vuqiro/config";
import { MockPayoutsProvider } from "./mockPayoutsProvider";
import { StripePayoutsProvider } from "./stripePayoutsProvider";
import type { PayoutsProvider } from "./payoutsProvider";

let cached: PayoutsProvider | null = null;

/** Stripe when STRIPE_SECRET_KEY exists; mock otherwise. */
export function getPayoutsProvider(): PayoutsProvider {
  if (cached) return cached;
  const env = loadEnv();
  cached = env.stripeSecretKey
    ? new StripePayoutsProvider({ secretKey: env.stripeSecretKey, webhookSecret: env.stripeWebhookSecret })
    : new MockPayoutsProvider();
  return cached;
}

export function resetPayoutsProviderCache(): void {
  cached = null;
}
