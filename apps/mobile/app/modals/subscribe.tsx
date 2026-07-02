import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { mockCreators } from "@vuqiro/mock-data";
import { ModalShell } from "../../src/components/ModalShell";
import { PackageCard } from "../../src/components/PackageCard";
import { colors, spacing } from "../../src/design/theme";

export default function SubscribeModal() {
  const { creatorId } = useLocalSearchParams<{ creatorId?: string }>();
  const creator = mockCreators.find((item) => item.id === creatorId);

  return (
    <ModalShell
      title="Choose your support level"
      subtitle={
        creator
          ? `Support ${creator.displayName} directly and unlock more from their world.`
          : "Support creators directly and unlock more from their world."
      }
    >
      <PackageCard
        title="Support"
        price="$2.99/mo"
        description="Start supporting a creator."
        benefits={["Supporter badge", "Basic locked posts", "Subscriber comments"]}
      />
      <PackageCard
        title="Plus"
        price="$5.99/mo"
        description="More premium content."
        benefits={["Premium videos", "Early drops", "Creator updates"]}
        highlighted
      />
      <PackageCard
        title="Premium"
        price="$9.99/mo"
        description="Top-tier creator access."
        benefits={["Exclusive drops", "Priority interaction", "Premium badge"]}
      />
      <Text style={styles.disclaimer}>
        Prices are mocked. Live prices must come from App Store / Google Play / RevenueCat.
      </Text>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  disclaimer: { color: colors.warning, fontSize: 12, marginTop: spacing.md, lineHeight: 18 }
});
