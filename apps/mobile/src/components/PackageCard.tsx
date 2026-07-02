import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../design/theme";

type Props = {
  title: string;
  price: string;
  description: string;
  benefits: string[];
  highlighted?: boolean;
  onPress?: () => void;
};

export function PackageCard({ title, price, description, benefits, highlighted, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.card, highlighted && styles.highlighted]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.price}>{price}</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      {benefits.map((benefit) => (
        <Text key={benefit} style={styles.benefit}>• {benefit}</Text>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: 8, marginBottom: spacing.md },
  highlighted: { borderColor: colors.primary, backgroundColor: "rgba(124,58,237,0.16)" },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  title: { color: colors.text, fontWeight: "900", fontSize: 18 },
  price: { color: colors.secondary, fontWeight: "900" },
  description: { color: colors.textMuted, lineHeight: 20 },
  benefit: { color: colors.textSoft, fontSize: 13 }
});
