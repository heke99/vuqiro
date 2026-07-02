import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { mockCreators } from "@vuqiro/mock-data";
import type { PaymentsOfferingPackage } from "@vuqiro/services/payments";
import { ModalShell } from "../../src/components/ModalShell";
import { PackageCard } from "../../src/components/PackageCard";
import { trackEvent } from "../../src/features/video/videoEvents";
import { getPaymentsProvider, isUsingRealPayments } from "../../src/services/payments/getPaymentsProvider";
import { RevenueCatPaymentsProvider } from "../../src/services/payments/revenueCatPaymentsProvider";
import { colors, spacing } from "../../src/design/theme";

const tierBenefits: Record<string, string[]> = {
  support_monthly: ["Supporter badge", "Basic locked posts", "Subscriber comments"],
  plus_monthly: ["Premium videos", "Early drops", "Creator updates"],
  premium_monthly: ["Exclusive drops", "Priority interaction", "Premium badge"]
};

export default function SubscribeModal() {
  const { creatorId } = useLocalSearchParams<{ creatorId?: string }>();
  const creator = mockCreators.find((item) => item.id === creatorId);
  const [packages, setPackages] = useState<PaymentsOfferingPackage[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("creator_subscribe_open", { creatorId });
    let cancelled = false;
    (async () => {
      const provider = getPaymentsProvider();
      const offerings = await provider.getOfferings();
      const memberships = offerings.find((offering) => offering.identifier === "creator_memberships");
      if (!cancelled && memberships) setPackages(memberships.packages);
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const buy = async (pkg: PaymentsOfferingPackage) => {
    setStatus(null);
    const provider = getPaymentsProvider();
    // Attribute the subscription to the creator so the webhook can link it.
    if (creatorId && provider instanceof RevenueCatPaymentsProvider) {
      await provider.setIntendedCreator(creatorId);
    }
    const result = await provider.purchase(pkg.identifier);
    if (result.success) {
      trackEvent("creator_subscribe_success", { creatorId });
      setStatus(
        isUsingRealPayments()
          ? "Purchase complete. Your membership activates as soon as the store confirms it."
          : "Demo purchase recorded. Real purchases require the App Store / Google Play build."
      );
    } else if (!result.cancelled) {
      setStatus(result.errorMessage ?? "Purchase failed");
    }
  };

  return (
    <ModalShell
      title="Choose your support level"
      subtitle={
        creator
          ? `Support ${creator.displayName} directly and unlock more from their world.`
          : "Support creators directly and unlock more from their world."
      }
    >
      {packages.map((pkg, index) => (
        <PackageCard
          key={pkg.identifier}
          title={pkg.title}
          price={`${pkg.priceString}/${pkg.periodLabel ?? "mo"}`}
          description={pkg.description}
          benefits={tierBenefits[pkg.identifier] ?? []}
          highlighted={index === 1}
          onPress={() => buy(pkg)}
        />
      ))}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Text style={styles.disclaimer}>
        {isUsingRealPayments()
          ? "Prices are provided by the App Store / Google Play. Subscriptions renew automatically and can be cancelled in your store account settings."
          : "Demo prices shown. Live prices come from App Store / Google Play via RevenueCat once payment keys are configured."}
      </Text>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  status: { color: colors.success, fontWeight: "700", marginTop: spacing.md, lineHeight: 20 },
  disclaimer: { color: colors.warning, fontSize: 12, marginTop: spacing.md, lineHeight: 18 }
});
