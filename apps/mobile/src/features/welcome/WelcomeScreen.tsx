import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { colors, spacing } from "../../design/theme";

export function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <LinearGradient colors={["#07070A", "#121026", "#07070A"]} style={styles.container}>
      <View style={styles.logoMark}>
        <Text style={styles.logoLetter}>V</Text>
      </View>
      <Text style={styles.title}>Vuqiro</Text>
      <Text style={styles.subtitle}>Discover creators. Support what you love.</Text>
      <View style={styles.actions}>
        <Button label="Create account" onPress={onEnter} />
        <Button label="Sign in" variant="ghost" onPress={onEnter} />
        <Button label="Continue exploring" variant="ghost" onPress={onEnter} />
      </View>
      <Text style={styles.legal}>by Diversa Solutions LLC</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  logoMark: { width: 96, height: 96, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 30 },
  logoLetter: { color: colors.white, fontSize: 54, fontWeight: "900" },
  title: { color: colors.text, fontSize: 44, fontWeight: "900", marginTop: spacing.xl },
  subtitle: { color: colors.textMuted, fontSize: 17, textAlign: "center", marginTop: spacing.sm, maxWidth: 280, lineHeight: 24 },
  actions: { width: "100%", gap: spacing.md, marginTop: spacing.xxl },
  legal: { color: colors.textMuted, marginTop: spacing.xxl, fontSize: 12 }
});
