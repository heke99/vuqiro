import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { colors, spacing } from "../../src/design/theme";

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <LinearGradient colors={["#07070A", "#121026", "#07070A"]} style={styles.container}>
      <View style={styles.logoMark}>
        <Text style={styles.logoLetter}>V</Text>
      </View>
      <Text style={styles.title}>Vuqiro</Text>
      <Text style={styles.subtitle}>Discover creators. Support what you love.</Text>
      <Text style={styles.freeNote}>
        Watching is free — browse the feed and public videos without an account or payment.
      </Text>
      <View style={styles.actions}>
        <Button label="Create account" onPress={() => router.push("/(public)/create-account")} />
        <Button label="Sign in" variant="ghost" onPress={() => router.push("/(public)/sign-in")} />
        <Button
          label="Continue exploring"
          variant="ghost"
          onPress={() => router.replace("/(tabs)/feed")}
        />
      </View>
      <Text style={styles.legal}>by Diversa Solutions LLC</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  logoMark: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 30
  },
  logoLetter: { color: colors.white, fontSize: 54, fontWeight: "900" },
  title: { color: colors.text, fontSize: 44, fontWeight: "900", marginTop: spacing.xl },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 280,
    lineHeight: 24
  },
  freeNote: {
    color: colors.textSoft,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.md,
    maxWidth: 300,
    lineHeight: 19
  },
  actions: { width: "100%", gap: spacing.md, marginTop: spacing.xxl },
  legal: { color: colors.textMuted, marginTop: spacing.xxl, fontSize: 12 }
});
