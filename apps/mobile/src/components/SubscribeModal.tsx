import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { PackageCard } from "./PackageCard";
import { colors, radii, spacing } from "../design/theme";

export function SubscribeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose your support level</Text>
          <Text style={styles.subtitle}>Support creators directly and unlock more from their world.</Text>
          <PackageCard title="Support" price="$2.99/mo" description="Start supporting a creator." benefits={["Supporter badge", "Basic locked posts", "Subscriber comments"]} />
          <PackageCard title="Plus" price="$5.99/mo" description="More premium content." benefits={["Premium videos", "Early drops", "Creator updates"]} highlighted />
          <PackageCard title="Premium" price="$9.99/mo" description="Top-tier creator access." benefits={["Exclusive drops", "Priority interaction", "Premium badge"]} />
          <Text style={styles.disclaimer}>Prices are mocked. Live prices must come from App Store / Google Play / RevenueCat.</Text>
          <Button label="Close" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: "92%" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  disclaimer: { color: colors.warning, fontSize: 12, marginVertical: spacing.md, lineHeight: 18 }
});
