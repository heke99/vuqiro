import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { completeOnboarding, getOnboardingDraft, saveOnboardingDraft } from "../../src/features/onboarding/onboardingState";
import { registerForPush } from "../../src/services/push/registerPush";
import { colors, radii, spacing } from "../../src/design/theme";

export default function ConsentsScreen() {
  const router = useRouter();
  const [personalizedAds, setPersonalizedAds] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      await saveOnboardingDraft({ personalizedAds, notifications });
      const draft = await getOnboardingDraft();
      await completeOnboarding(draft);
      if (notifications) {
        // Fire-and-forget: permission prompt + token registration.
        void registerForPush();
      }
      router.replace("/(tabs)/feed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.step}>Step 4 of 4</Text>
      <Text style={styles.title}>Your choices</Text>
      <Text style={styles.copy}>
        You already accepted the Terms of Service and Privacy Policy when creating your account. These two are
        optional and can be changed any time in Settings.
      </Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Personalized ads</Text>
          <Text style={styles.rowCopy}>
            Allow Vuqiro to use your interests to show more relevant sponsored content. Opting out means you still
            see ads, just less relevant ones.
          </Text>
        </View>
        <Switch value={personalizedAds} onValueChange={setPersonalizedAds} />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Push notifications</Text>
          <Text style={styles.rowCopy}>New followers, comments and creator updates. The system prompt appears next.</Text>
        </View>
        <Switch value={notifications} onValueChange={setNotifications} />
      </View>

      <Pressable onPress={() => router.push("/legal/privacy")}>
        <Text style={styles.legalLink}>Read the Privacy Policy →</Text>
      </Pressable>

      <Button label={busy ? "Finishing…" : "Start watching"} onPress={finish} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginTop: spacing.xs },
  copy: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  rowTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  rowCopy: { color: colors.textSoft, lineHeight: 18, fontSize: 13, marginTop: 2 },
  legalLink: { color: colors.secondary, fontWeight: "800", marginTop: spacing.md }
});
