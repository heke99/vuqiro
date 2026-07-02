import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../design/theme";

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: Math.max(14, size * 0.32) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderWidth: 2, borderColor: "rgba(255,255,255,0.24)" },
  initials: { color: colors.white, fontWeight: "900" }
});
