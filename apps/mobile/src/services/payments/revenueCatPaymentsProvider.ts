import { Platform } from "react-native";
import type { PaymentsOffering, PaymentsProvider, PurchaseResult } from "@vuqiro/services/payments";

const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export function areRevenueCatKeysConfigured(): boolean {
  return Platform.OS === "ios" ? Boolean(iosKey) : Boolean(androidKey);
}

type PurchasesModule = typeof import("react-native-purchases").default;

let purchasesModule: PurchasesModule | null | undefined;

/**
 * Lazily loads react-native-purchases. The native module only exists inside
 * an EAS development/production build — inside Expo Go this returns null and
 * the app stays on the mock provider instead of crashing.
 */
function loadPurchases(): PurchasesModule | null {
  if (purchasesModule !== undefined) return purchasesModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchasesModule = (require("react-native-purchases") as { default: PurchasesModule }).default;
  } catch {
    purchasesModule = null;
  }
  return purchasesModule;
}

export function isRevenueCatAvailable(): boolean {
  return areRevenueCatKeysConfigured() && loadPurchases() !== null;
}

/**
 * Real RevenueCat payments provider. Prices shown to users always come from
 * the store via offerings. Server entitlement sync happens through the
 * RevenueCat webhook — never from this client.
 */
export class RevenueCatPaymentsProvider implements PaymentsProvider {
  readonly name = "revenuecat" as const;
  private configured = false;

  async configure(userId: string): Promise<void> {
    const Purchases = loadPurchases();
    if (!Purchases) throw new Error("react-native-purchases native module unavailable");
    const apiKey = Platform.OS === "ios" ? iosKey : androidKey;
    if (!apiKey) throw new Error("RevenueCat API key missing");
    Purchases.configure({ apiKey, appUserID: userId });
    this.configured = true;
  }

  async getOfferings(): Promise<PaymentsOffering[]> {
    const Purchases = loadPurchases();
    if (!Purchases || !this.configured) return [];
    const offerings = await Purchases.getOfferings();
    return Object.values(offerings.all).map((offering) => ({
      identifier: offering.identifier,
      packages: offering.availablePackages.map((pkg) => ({
        identifier: pkg.identifier,
        storeProductId: pkg.product.identifier,
        title: pkg.product.title,
        description: pkg.product.description,
        priceString: pkg.product.priceString,
        periodLabel: pkg.product.subscriptionPeriod ?? undefined
      }))
    }));
  }

  async purchase(packageIdentifier: string): Promise<PurchaseResult> {
    const Purchases = loadPurchases();
    if (!Purchases || !this.configured) {
      return { success: false, cancelled: false, errorMessage: "Payments unavailable" };
    }
    try {
      const offerings = await Purchases.getOfferings();
      for (const offering of Object.values(offerings.all)) {
        const pkg = offering.availablePackages.find((candidate) => candidate.identifier === packageIdentifier);
        if (pkg) {
          const result = await Purchases.purchasePackage(pkg);
          return {
            success: true,
            cancelled: false,
            storeTransactionId: result.transaction?.transactionIdentifier ?? undefined
          };
        }
      }
      return { success: false, cancelled: false, errorMessage: `Package ${packageIdentifier} not found` };
    } catch (error) {
      const cancelled = (error as { userCancelled?: boolean }).userCancelled === true;
      return {
        success: false,
        cancelled,
        errorMessage: cancelled ? undefined : error instanceof Error ? error.message : "Purchase failed"
      };
    }
  }

  async restorePurchases(): Promise<{ restored: number }> {
    const Purchases = loadPurchases();
    if (!Purchases || !this.configured) return { restored: 0 };
    const info = await Purchases.restorePurchases();
    return { restored: Object.keys(info.entitlements.active).length };
  }

  /** Attribute a pending subscription purchase to a creator (webhook reads it). */
  async setIntendedCreator(creatorId: string): Promise<void> {
    const Purchases = loadPurchases();
    if (!Purchases || !this.configured) return;
    await Purchases.setAttributes({ intended_creator: creatorId });
  }
}
