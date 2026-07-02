import type { PaymentsProvider } from "@vuqiro/services/payments";
import { MockPaymentsProvider } from "./mockPaymentsProvider";
import { isRevenueCatAvailable, RevenueCatPaymentsProvider } from "./revenueCatPaymentsProvider";

let cached: PaymentsProvider | null = null;

/**
 * Returns the active payments provider:
 * RevenueCat when keys are configured AND the native module exists (EAS
 * dev/production build); the mock provider otherwise (Expo Go, no keys).
 */
export function getPaymentsProvider(): PaymentsProvider {
  if (cached) return cached;
  cached = isRevenueCatAvailable() ? new RevenueCatPaymentsProvider() : new MockPaymentsProvider();
  return cached;
}

export function isUsingRealPayments(): boolean {
  return getPaymentsProvider().name === "revenuecat";
}
