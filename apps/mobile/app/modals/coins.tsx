import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CoinPackCard } from "../../src/components/CoinPackCard";
import { ModalShell } from "../../src/components/ModalShell";
import { colors, spacing } from "../../src/design/theme";

export default function CoinsModal() {
  return (
    <ModalShell title="Buy coins" subtitle="Use coins for tips, unlocks and boosts.">
      <View style={styles.grid}>
        <CoinPackCard coins={100} price="$1.99" />
        <CoinPackCard coins={500} bonus={25} price="$7.99" />
        <CoinPackCard coins={1200} bonus={100} price="$14.99" />
        <CoinPackCard coins={5000} bonus={700} price="$49.99" />
      </View>
      <Text style={styles.disclaimer}>
        Mock purchase only. Real coin purchases must use Apple IAP / Google Play Billing via
        RevenueCat.
      </Text>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: "4%" },
  disclaimer: { color: colors.warning, fontSize: 12, marginTop: spacing.md, lineHeight: 18 }
});
