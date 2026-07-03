import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { saveOnboardingDraft } from "../../src/features/onboarding/onboardingState";
import { colors, radii, spacing } from "../../src/design/theme";

export default function AccountTypeScreen() {
  const router = useRouter();
  const [wantsCreator, setWantsCreator] = useState(false);

  const next = async () => {
    await saveOnboardingDraft({ wantsCreator });
    router.push("/(onboarding)/consents");
  };

  return (
    <Screen>
      <Text style={styles.step}>Step 3 of 4</Text>
      <Text style={styles.title}>How will you use Vuqiro?</Text>
      <Text style={styles.copy}>You can become a creator later at any time from your profile.</Text>

      <Pressable style={[styles.option, !wantsCreator && styles.optionSelected]} onPress={() => setWantsCreator(false)}>
        <Text style={styles.optionTitle}>Watch & explore</Text>
        <Text style={styles.optionCopy}>Enjoy the feed, follow creators, comment and save videos.</Text>
      </Pressable>

      <Pressable style={[styles.option, wantsCreator && styles.optionSelected]} onPress={() => setWantsCreator(true)}>
        <Text style={styles.optionTitle}>Create & earn</Text>
        <Text style={styles.optionCopy}>
          Upload videos, grow an audience and unlock monetization: memberships, coin unlocks and payouts.
        </Text>
      </Pressable>

      <Button label="Continue" onPress={next} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginTop: spacing.xs },
  copy: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.xl },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: "rgba(124,58,237,0.12)" },
  optionTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  optionCopy: { color: colors.textSoft, lineHeight: 20 }
});
