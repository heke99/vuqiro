import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "../design/theme";

export function CoinPackCard({ coins, bonus, price, onPress }: { coins: number; bonus?: number; price: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.coins}>{coins.toLocaleString()} coins</Text>
      {bonus ? <Text style={styles.bonus}>+{bonus} bonus</Text> : <Text style={styles.bonus}>Starter pack</Text>}
      <Text style={styles.price}>{price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: "48%", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: spacing.lg, gap: 8 },
  coins: { color: colors.text, fontWeight: "900", fontSize: 17 },
  bonus: { color: colors.textMuted, fontSize: 13 },
  price: { color: colors.secondary, fontWeight: "900" }
});
