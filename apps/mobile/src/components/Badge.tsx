import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../design/theme";

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "secondary" | "warning" | "danger" }) {
  const backgroundColor = tone === "secondary" ? colors.secondarySoft : tone === "warning" ? "rgba(245,158,11,0.16)" : tone === "danger" ? "rgba(239,68,68,0.16)" : colors.primarySoft;
  const color = tone === "secondary" ? colors.secondary : tone === "warning" ? colors.warning : tone === "danger" ? colors.danger : colors.text;
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6, alignSelf: "flex-start" },
  label: { fontSize: 12, fontWeight: "800" }
});
