import type { PaymentsOffering, PaymentsProvider, PurchaseResult } from "@vuqiro/services/payments";

const PRODUCT_PREFIX = "com.diversasolutions.vuqiro";

/**
 * Mock payments provider: serves the reference catalog with mocked prices
 * and always-successful purchases. Active until RevenueCat keys exist and a
 * development build is installed. Mock purchases never grant real
 * entitlements — the server stays the entitlement authority.
 */
export class MockPaymentsProvider implements PaymentsProvider {
  readonly name = "mock" as const;

  async configure(_userId: string): Promise<void> {
    // nothing to configure
  }

  async getOfferings(): Promise<PaymentsOffering[]> {
    return [
      {
        identifier: "creator_memberships",
        packages: [
          {
            identifier: "support_monthly",
            storeProductId: `${PRODUCT_PREFIX}.creator.support.monthly`,
            title: "Support",
            description: "Start supporting a creator.",
            priceString: "$2.99",
            periodLabel: "month"
          },
          {
            identifier: "plus_monthly",
            storeProductId: `${PRODUCT_PREFIX}.creator.plus.monthly`,
            title: "Plus",
            description: "More premium content.",
            priceString: "$5.99",
            periodLabel: "month"
          },
          {
            identifier: "premium_monthly",
            storeProductId: `${PRODUCT_PREFIX}.creator.premium.monthly`,
            title: "Premium",
            description: "Top-tier creator access.",
            priceString: "$9.99",
            periodLabel: "month"
          }
        ]
      },
      {
        identifier: "coins",
        packages: [
          { identifier: "coins_100", storeProductId: `${PRODUCT_PREFIX}.coins.100`, title: "100 Coins", description: "Small starter coin pack.", priceString: "$1.99" },
          { identifier: "coins_500", storeProductId: `${PRODUCT_PREFIX}.coins.500`, title: "500 Coins (+25)", description: "Most popular starter pack.", priceString: "$7.99" },
          { identifier: "coins_1200", storeProductId: `${PRODUCT_PREFIX}.coins.1200`, title: "1,200 Coins (+100)", description: "More coins for active supporters.", priceString: "$14.99" },
          { identifier: "coins_5000", storeProductId: `${PRODUCT_PREFIX}.coins.5000`, title: "5,000 Coins (+700)", description: "Large creator support pack.", priceString: "$49.99" }
        ]
      }
    ];
  }

  async purchase(packageIdentifier: string): Promise<PurchaseResult> {
    return {
      success: true,
      cancelled: false,
      storeTransactionId: `mock_txn_${packageIdentifier}_${Date.now()}`
    };
  }

  async restorePurchases(): Promise<{ restored: number }> {
    return { restored: 0 };
  }
}
