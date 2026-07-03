import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { getOnboardingDraft, saveOnboardingDraft } from "../../src/features/onboarding/onboardingState";
import { colors, radii, spacing } from "../../src/design/theme";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "sv", label: "Svenska" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" }
];

const COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "SE", label: "Sweden" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "BR", label: "Brazil" },
  { code: "IN", label: "India" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" }
];

export default function LocaleScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<string | undefined>();
  const [country, setCountry] = useState<string | undefined>();

  useEffect(() => {
    getOnboardingDraft().then((draft) => {
      setLanguage(draft.language);
      setCountry(draft.country);
    });
  }, []);

  const next = async () => {
    await saveOnboardingDraft({ language, country });
    router.push("/(onboarding)/account-type");
  };

  return (
    <Screen>
      <Text style={styles.step}>Step 2 of 4</Text>
      <Text style={styles.title}>Language & country</Text>
      <Text style={styles.copy}>Used for your feed, captions and local trends.</Text>

      <Text style={styles.sectionTitle}>Language</Text>
      <View style={styles.grid}>
        {LANGUAGES.map((item) => (
          <Pressable
            key={item.code}
            style={[styles.chip, language === item.code && styles.chipSelected]}
            onPress={() => setLanguage(item.code)}
          >
            <Text style={[styles.chipText, language === item.code && styles.chipTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Country</Text>
      <View style={styles.grid}>
        {COUNTRIES.map((item) => (
          <Pressable
            key={item.code}
            style={[styles.chip, country === item.code && styles.chipSelected]}
            onPress={() => setCountry(item.code)}
          >
            <Text style={[styles.chipText, country === item.code && styles.chipTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Button
        label="Continue"
        onPress={next}
        variant={language && country ? "primary" : "ghost"}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginTop: spacing.xs },
  copy: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: spacing.xl, marginBottom: spacing.md },
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
