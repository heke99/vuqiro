import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../design/theme";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = "primary", style }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.base, styles[variant], style]}>
      <Text style={[styles.label, variant === "ghost" && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center"
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  ghost: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  label: { color: colors.white, fontSize: 15, fontWeight: "800" },
  ghostLabel: { color: colors.text }
});
