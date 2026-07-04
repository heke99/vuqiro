import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import {
  getOnboardingDraft,
  INTEREST_OPTIONS,
  saveOnboardingDraft
} from "../../src/features/onboarding/onboardingState";
import { colors, radii, spacing } from "../../src/design/theme";

export default function InterestsScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getOnboardingDraft().then((draft) => setSelected(new Set(draft.interests)));
  }, []);

  const toggle = (slug: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const next = async () => {
    await saveOnboardingDraft({ interests: [...selected] });
    router.push("/(onboarding)/locale");
  };

  return (
    <Screen>
      <Text style={styles.step}>Step 1 of 4</Text>
      <Text style={styles.title}>What are you into?</Text>
      <Text style={styles.copy}>Pick at least 3 topics — your For You feed starts here.</Text>
      <View style={styles.grid}>
        {INTEREST_OPTIONS.map((interest) => (
          <Pressable
            key={interest.slug}
            style={[styles.chip, selected.has(interest.slug) && styles.chipSelected]}
            onPress={() => toggle(interest.slug)}
          >
            <Text style={[styles.chipText, selected.has(interest.slug) && styles.chipTextSelected]}>
              {interest.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button
        label={selected.size >= 3 ? "Continue" : `Pick ${3 - selected.size} more`}
        onPress={next}
        variant={selected.size >= 3 ? "primary" : "ghost"}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginTop: spacing.xs },
  copy: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSoft, fontWeight: "800" },
  chipTextSelected: { color: colors.white }
});
