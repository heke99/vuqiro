/**
 * Mobile payments adapter contract (RevenueCat first).
 *
 * The client uses this to fetch offerings and start purchases; the server
 * remains the entitlement authority via webhooks. Never grant paid access
 * from client state alone.
 */

export type PaymentsPlatform = "ios" | "android" | "web";

export interface PaymentsOfferingPackage {
  identifier: string;
  storeProductId: string;
  title: string;
  description: string;
  /** Localized, store-provided price string (e.g. "$4.99"). */
  priceString: string;
  periodLabel?: string;
}

export interface PaymentsOffering {
  identifier: string;
  packages: PaymentsOfferingPackage[];
}

export interface PurchaseResult {
  success: boolean;
  cancelled: boolean;
  storeTransactionId?: string;
  errorMessage?: string;
}

export interface PaymentsProvider {
  readonly name: "revenuecat" | "mock";
  configure(userId: string): Promise<void>;
  getOfferings(): Promise<PaymentsOffering[]>;
  purchase(packageIdentifier: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<{ restored: number }>;
}
