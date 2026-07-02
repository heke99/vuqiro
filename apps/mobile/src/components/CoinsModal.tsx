import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { CoinPackCard } from "./CoinPackCard";
import { colors, radii, spacing } from "../design/theme";

export function CoinsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Buy coins</Text>
          <Text style={styles.subtitle}>Use coins for tips, unlocks and boosts.</Text>
          <View style={styles.grid}>
            <CoinPackCard coins={100} price="$1.99" />
            <CoinPackCard coins={500} bonus={25} price="$7.99" />
            <CoinPackCard coins={1200} bonus={100} price="$14.99" />
            <CoinPackCard coins={5000} bonus={700} price="$49.99" />
          </View>
          <Text style={styles.disclaimer}>Mock purchase only. Real coin purchases must use IAP/Google Play Billing via RevenueCat.</Text>
          <Button label="Close" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: "4%" },
  disclaimer: { color: colors.warning, fontSize: 12, marginVertical: spacing.lg, lineHeight: 18 }
});
