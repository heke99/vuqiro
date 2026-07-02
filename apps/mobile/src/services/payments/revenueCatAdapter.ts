// Future adapter for RevenueCat React Native Purchases.
// Do not trust client entitlements as source of truth. Backend verification/webhooks are required.

export async function initializeRevenueCat() {
  return {
    enabled: false,
    reason: "RevenueCat is scaffolded but disabled in Batch 1. Enable after App Store / Google Play products exist."
  };
}
