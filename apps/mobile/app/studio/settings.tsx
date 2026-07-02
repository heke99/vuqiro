import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { apiFetch, isApiConfigured } from "../../src/services/api/client";
import { colors, spacing } from "../../src/design/theme";

const allTiers = ["support", "plus", "premium"] as const;

export default function StudioSettings() {
  const router = useRouter();
  const [enabledTiers, setEnabledTiers] = useState<Set<string>>(new Set(["support", "plus", "premium"]));
  const [status, setStatus] = useState<string | null>(null);

  const toggleTier = (tier: string) => {
    setEnabledTiers((current) => {
      const next = new Set(current);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  const save = async () => {
    setStatus(null);
    if (!isApiConfigured()) {
      setStatus("Saved (demo mode).");
      return;
    }
    try {
      await apiFetch("/creators/me/tiers", {
        method: "POST",
        body: JSON.stringify({ tiersEnabled: [...enabledTiers] })
      });
      setStatus("Tier settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    }
  };

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: spacing.md }} />
      <Text style={styles.title}>Creator settings</Text>
      <Text style={styles.subtitle}>Configure your subscription tiers and storefront.</Text>

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.cardTitle}>Subscription tiers</Text>
        <Text style={styles.copy}>
          Choose which membership tiers your audience can buy. Prices are managed by Vuqiro through
          official store products.
        </Text>
        <View style={styles.tiers}>
          {allTiers.map((tier) => (
            <Pressable key={tier} onPress={() => toggleTier(tier)}>
              <Badge label={`${tier}${enabledTiers.has(tier) ? " ✓" : ""}`} tone={enabledTiers.has(tier) ? "secondary" : "primary"} />
            </Pressable>
          ))}
        </View>
        <Button label="Save tiers" onPress={save} />
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </Card>

      <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Text style={styles.cardTitle}>Payouts</Text>
        <Text style={styles.copy}>Manage your Stripe Connect account and payout preferences.</Text>
        <Button label="Open payout settings" variant="ghost" onPress={() => router.push("/studio/payouts")} />
      </Card>

      <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Text style={styles.cardTitle}>Legal</Text>
        <Text style={styles.copy}>Creator monetization is governed by the Creator Terms and Payout Terms.</Text>
        <Button label="Creator terms" variant="ghost" onPress={() => router.push("/legal/creator-terms")} />
        <Button label="Payout terms" variant="ghost" onPress={() => router.push("/legal/payout-terms")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  copy: { color: colors.textSoft, lineHeight: 20 },
  tiers: { flexDirection: "row", gap: spacing.sm },
  status: { color: colors.success, fontWeight: "700" }
});
