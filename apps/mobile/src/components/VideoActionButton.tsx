import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../design/theme";

type IconName = keyof typeof Ionicons.glyphMap;

export function VideoActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <View style={styles.circle}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: "center", gap: 5 },
  circle: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(0,0,0,0.42)", borderColor: colors.border, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label: { color: colors.text, fontSize: 11, fontWeight: "700" }
});
