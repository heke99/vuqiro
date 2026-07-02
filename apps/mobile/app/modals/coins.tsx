import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PaymentsOfferingPackage } from "@vuqiro/services/payments";
import { CoinPackCard } from "../../src/components/CoinPackCard";
import { ModalShell } from "../../src/components/ModalShell";
import { trackEvent } from "../../src/features/video/videoEvents";
import { getPaymentsProvider, isUsingRealPayments } from "../../src/services/payments/getPaymentsProvider";
import { colors, spacing } from "../../src/design/theme";

function coinsFromTitle(title: string): number {
  const match = title.replace(/,/g, "").match(/(\d+)\s*Coins/i);
  return match ? Number(match[1]) : 0;
}

export default function CoinsModal() {
  const [packages, setPackages] = useState<PaymentsOfferingPackage[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("coin_pack_open");
    let cancelled = false;
    (async () => {
      const offerings = await getPaymentsProvider().getOfferings();
      const coins = offerings.find((offering) => offering.identifier === "coins");
      if (!cancelled && coins) setPackages(coins.packages);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buy = async (pkg: PaymentsOfferingPackage) => {
    setStatus(null);
    const result = await getPaymentsProvider().purchase(pkg.identifier);
    if (result.success) {
      trackEvent("coin_purchase_success");
      setStatus(
        isUsingRealPayments()
          ? "Purchase complete. Coins are credited as soon as the store confirms the transaction."
          : "Demo purchase recorded. Real coin purchases require the App Store / Google Play build."
      );
    } else if (!result.cancelled) {
      setStatus(result.errorMessage ?? "Purchase failed");
    }
  };

  return (
    <ModalShell title="Buy coins" subtitle="Use coins for tips, unlocks and boosts.">
      <View style={styles.grid}>
        {packages.map((pkg) => (
          <CoinPackCard
            key={pkg.identifier}
            coins={coinsFromTitle(pkg.title)}
            price={pkg.priceString}
            onPress={() => buy(pkg)}
          />
        ))}
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Text style={styles.disclaimer}>
        {isUsingRealPayments()
          ? "Prices are provided by the App Store / Google Play. Coins have no cash value and are credited after store confirmation."
          : "Demo prices shown. Real coin purchases use Apple IAP / Google Play Billing via RevenueCat once keys are configured."}
      </Text>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: "4%", rowGap: spacing.md },
  status: { color: colors.success, fontWeight: "700", marginTop: spacing.md, lineHeight: 20 },
  disclaimer: { color: colors.warning, fontSize: 12, marginTop: spacing.md, lineHeight: 18 }
});
